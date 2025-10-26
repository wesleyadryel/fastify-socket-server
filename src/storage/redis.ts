import { storageEvents } from './events';
import { storageConfig } from './config';
import { getRedisConnection } from './redis-connection';

export interface StoredUser {
  socketId: string;
  authenticated: boolean;
  identifiers: Record<string, any>;
  connectedAt: string;
  lastSeen: string;
  rooms: string[];
}

class RedisStorage {
  private useRedis: boolean;
  private localCache = new Map<string, StoredUser>();
  private ttl = storageConfig.ttl;

  constructor() {
    this.useRedis = storageConfig.useRedis;
  }

  private get redis() {
    return getRedisConnection();
  }

  private getJWTKey(jwtToken: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(jwtToken).digest('hex');
    return `${storageConfig.userKeyPrefix}:${hash}`;
  }

  private getUserUuidKey(userUuid: string): string {
    return `${storageConfig.userUuidKeyPrefix}:${userUuid}`;
  }

  private getKeyUserTokenByUuid(userUuid: string): string {
    return `${storageConfig.userKeyPrefix}:${userUuid}`;
  }

  private getSocketIdToJWTKey(socketId: string): string {
    return `socket-to-jwt:${socketId}`;
  }

  private async saveUserData(jwtToken: string, userData: StoredUser, eventType: 'user_connected' | 'user_updated', identifiers: Record<string, any>): Promise<void> {
    this.localCache.set(jwtToken, userData);

    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        const socketToJWTKey = this.getSocketIdToJWTKey(userData.socketId);

        const pipeline = this.redis.pipeline()
          .hset(key, {
            socketId: userData.socketId,
            authenticated: userData.authenticated.toString(),
            identifiers: JSON.stringify(userData.identifiers),
            connectedAt: userData.connectedAt,
            lastSeen: userData.lastSeen,
            rooms: JSON.stringify(userData.rooms)
          })
          .expire(key, this.ttl);

        if (userData.socketId !== storageConfig.tempSocketId) {
          pipeline.set(socketToJWTKey, jwtToken, 'EX', this.ttl);
        }

        await pipeline.exec();
        
        storageEvents.emitUserEvent(eventType, userData.socketId, identifiers.userUuid || '', identifiers);
      } catch (error) {
        console.error('Redis storage error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      storageEvents.emitUserEvent(eventType, userData.socketId, identifiers.userUuid || '', identifiers);
    }
  }

  async addUser(jwtToken: string, socketId: string, authenticated: boolean, identifiers: Record<string, any>, rooms: string[] = []): Promise<void> {
    const userData: StoredUser = {
      socketId,
      authenticated,
      identifiers,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      rooms
    };
    await this.saveUserData(jwtToken, userData, 'user_connected', identifiers);
  }

  async updateUser(jwtToken: string, socketId: string, authenticated: boolean, identifiers: Record<string, any>, rooms: string[] = []): Promise<void> {
    const userData: StoredUser = {
      socketId,
      authenticated,
      identifiers,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      rooms
    };

    if (socketId === storageConfig.tempSocketId) {
      this.localCache.set(jwtToken, userData);
      storageEvents.emitUserEvent('user_updated', socketId, identifiers.userUuid || '', identifiers);
      return;
    }

    await this.saveUserData(jwtToken, userData, 'user_updated', identifiers);
  }

  async removeUser(jwtToken: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const userData = await this.getUserByJWT(jwtToken);
        if (userData) {
          await this.redis.del(this.getJWTKey(jwtToken));

          const userUuid = userData.identifiers.userUuid;
          if (userUuid) {
            const uuidKey = this.getUserUuidKey(userUuid);
            await this.redis.del(uuidKey);
            await this.redis.del(this.getKeyUserTokenByUuid(userUuid));
          }

          const socketToJWTKey = this.getSocketIdToJWTKey(userData.socketId);
          await this.redis.del(socketToJWTKey);
        }
        if (userData) {
          storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.identifiers.userUuid || '', userData.identifiers);
        }
      } catch (error) {
        console.error('Redis removal error:', error);
        this.localCache.delete(jwtToken);
      }
    } else {
      const userData = this.localCache.get(jwtToken);
      this.localCache.delete(jwtToken);
      if (userData) {
        storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.identifiers.userUuid || '', userData.identifiers);
      }
    }
  }

  async whenConnected(socketId: string, userUuid: string, jwtToken: string): Promise<void> {
    if (socketId !== storageConfig.tempSocketId) {
      const uuidKey = this.getUserUuidKey(userUuid);
      if (this.redis) {
        await this.redis.set(uuidKey, socketId, 'EX', this.ttl);
        await this.redis.set(this.getKeyUserTokenByUuid(userUuid), jwtToken, 'EX', this.ttl);
      }
    }
  }

  async getUserTokenByUuid(userUuid: string): Promise<string | null> {
    if (this.useRedis && this.redis) {
      return await this.redis.get(this.getKeyUserTokenByUuid(userUuid));
    }
    return null;
  }



  async getUserByJWT(jwtToken: string): Promise<StoredUser | undefined> {
    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        const data = await this.redis.hgetall(key);
        if (data && Object.keys(data).length > 0) {
          let identifiersData = {};
          let roomsData = [];

          try {
            identifiersData = JSON.parse(data.identifiers);
          } catch (e) {
            console.error('Error parsing identifiers data:', data.identifiers);
          }

          try {
            roomsData = JSON.parse(data.rooms);
          } catch (e) {
            console.error('Error parsing rooms data:', data.rooms);
          }

          return {
            socketId: data.socketId,
            authenticated: data.authenticated === 'true',
            identifiers: identifiersData,
            connectedAt: data.connectedAt,
            lastSeen: data.lastSeen,
            rooms: roomsData
          };
        }
        return undefined;
      } catch (error) {
        console.error('Redis get error:', error);
        return this.localCache.get(jwtToken);
      }
    } else {
      return this.localCache.get(jwtToken);
    }
  }


  async getUserBySocketIdFromCache(io: any, socketId: string): Promise<StoredUser | undefined> {
    const socket = io?.sockets?.sockets?.get(socketId);
    
    if (socket?.data?.authenticated && socket.data.token) {
      return await this.getUserByJWT(socket.data.token);
    }

    return await this.getUserBySocketId(socketId);
  }

  async getUserBySocketId(socketId: string): Promise<StoredUser | undefined> {
    for (const [jwtToken, user] of this.localCache.entries()) {
      if (user.socketId === socketId) {
        return user;
      }
    }
    
    if (this.useRedis && this.redis) {
      try {
        const socketToJWTKey = this.getSocketIdToJWTKey(socketId);
        const jwtToken = await this.redis.get(socketToJWTKey);
        
        if (jwtToken) {
          return await this.getUserByJWT(jwtToken);
        }
        
        return undefined;
      } catch (error) {
        console.error('Redis getUserBySocketId error:', error);
        return undefined;
      }
    }
    
    return undefined;
  }


  async getUsersByIdentifiers(identifiers: Record<string, any>): Promise<StoredUser[]> {
    if (identifiers.userUuid) {
      const jwtToken = await this.getUserTokenByUuid(identifiers.userUuid);
      if (jwtToken) {
        const user = await this.getUserByJWT(jwtToken);
        return user ? [user] : [];
      }
      return [];
    }

    // Buscar em todos os usuários do cache
    const cachedUsers = Array.from(this.localCache.values());
    
    return cachedUsers.filter(user => {
      return Object.entries(identifiers).every(([key, value]) => 
        user.identifiers[key] === value
      );
    });
  }




  async updateUserRooms(jwtToken: string, rooms: string[]): Promise<void> {
    const user = await this.getUserByJWT(jwtToken);
    if (user) {
      user.rooms = rooms;
      user.lastSeen = new Date().toISOString();

      if (this.useRedis && this.redis) {
        try {
          const key = this.getJWTKey(jwtToken);
          await this.redis.hset(key, {
            rooms: JSON.stringify(rooms),
            lastSeen: user.lastSeen
          });
          await this.redis.expire(key, this.ttl);
        } catch (error) {
          console.error('Redis updateUserRooms error:', error);
          this.localCache.set(jwtToken, user);
        }
      } else {
        this.localCache.set(jwtToken, user);
      }
    }
  }

  async removeUserByUuid(userUuid: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {

        const uuidKey = this.getUserUuidKey(userUuid);
        const socketId = await this.redis.get(uuidKey);
        
        if (!socketId) {
          return false;
        }


        const jwtToken = await this.getUserTokenByUuid(userUuid);

        if (!jwtToken) {
          return false;
        }


        await this.removeUser(jwtToken);
        

        await this.redis.del(uuidKey);
        
        return true;
      } catch (error) {
        console.error('Redis removeUserByUuid error:', error);
        return false;
      }
    } else {

      for (const [jwtToken, user] of this.localCache.entries()) {
        if (user.identifiers.userUuid === userUuid) {
          this.localCache.delete(jwtToken);
          storageEvents.emitUserEvent('user_disconnected', user.socketId, user.identifiers.userUuid || '', user.identifiers);
          return true;
        }
      }
      return false;
    }
  }


  async removeUserByIdentifiers(identifiers: Record<string, any>, token?: string): Promise<boolean> {

    if (identifiers.userUuid) {
      return await this.removeUserByUuid(identifiers.userUuid);
    }


    if (token) {
      const user = await this.getUserByJWT(token);
      if (user) {
        const matches = Object.keys(identifiers).every(key => user.identifiers[key] === identifiers[key]);
        if (matches) {
          await this.removeUser(token);
          return true;
        }
      }
      return false;
    }


    const users = await this.getUsersByIdentifiers(identifiers);
    const userToRemove = users.length > 0 ? users[0] : null;

    if (!userToRemove) {
      return false;
    }

    if (this.useRedis && this.redis) {
      try {
        // Avoid using KEYS pattern - get JWT from socketId mapping instead
        const socketToJWTKey = this.getSocketIdToJWTKey(userToRemove.socketId);
        const jwtToken = await this.redis.get(socketToJWTKey);
        
        if (jwtToken) {
          await this.removeUser(jwtToken);
          storageEvents.emitUserEvent('user_disconnected', userToRemove.socketId, userToRemove.identifiers.userUuid || '', userToRemove.identifiers);
          return true;
        }
      } catch (error) {
        console.error('Redis removeUserByIdentifiers error:', error);
      }
    } else {
      for (const [jwtToken, user] of this.localCache.entries()) {
        if (user.socketId === userToRemove.socketId) {
          this.localCache.delete(jwtToken);
          storageEvents.emitUserEvent('user_disconnected', userToRemove.socketId, userToRemove.identifiers.userUuid || '', userToRemove.identifiers);
          return true;
        }
      }
    }

    return false;
  }

  async invalidateToken(token: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const blacklistKey = `blacklist:${this.getJWTKey(token)}`;
        await this.redis.set(blacklistKey, '1', 'EX', this.ttl);
      } catch (error) {
        console.error('Redis token invalidation error:', error);
      }
    }
  }

  async isTokenInvalidated(token: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const blacklistKey = `blacklist:${this.getJWTKey(token)}`;
        const result = await this.redis.get(blacklistKey);
        return result === '1';
      } catch (error) {
        console.error('Redis token validation error:', error);
        return false;
      }
    }
    return false;
  }

  async getSocketClientByUuid(userUuid: string, io: any): Promise<{ socket: any | null; userData: StoredUser | null; isConnected: boolean } | null> {
    if (this.useRedis && this.redis) {
      try {

        const uuidKey = this.getUserUuidKey(userUuid);
        const socketId = await this.redis.get(uuidKey);

        if (!socketId) {
          return null;
        }

        const socket = io.sockets.sockets.get(socketId);
        const isConnected = !!socket;

        // Use socket-to-jwt mapping instead of scanning all keys
        const socketToJWTKey = this.getSocketIdToJWTKey(socketId);
        const jwtToken = await this.redis.get(socketToJWTKey);
        let userData: StoredUser | null = null;

        if (jwtToken) {
          const user = await this.getUserByJWT(jwtToken);
          userData = user || null;
        }

        return {
          socket: socket,
          userData: userData,
          isConnected: isConnected
        };
      } catch (error) {
        console.error('Redis getSocketClientByUuid error:', error);
        return null;
      }
    } else {

      for (const [jwtToken, userData] of this.localCache.entries()) {
        const userUuidFromData = userData.identifiers.userUuid;
        if (userUuidFromData === userUuid) {
          const socket = io.sockets.sockets.get(userData.socketId);
          const isConnected = !!socket;

          return {
            socket: socket,
            userData: userData,
            isConnected: isConnected
          };
        }
      }
      return null;
    }
  }

  async disconnect(): Promise<void> {
    // Redis connection is managed by singleton
    // Individual storage classes don't need to handle it
  }
}

export async function getSocketClientByUuid(userUuid: string, io: any): Promise<{ socket: any | null; userData: StoredUser | null; isConnected: boolean } | null> {
  return await redisStorage.getSocketClientByUuid(userUuid, io);
}

export async function getUserBySocketIdFromCache(io: any, socketId: string): Promise<StoredUser | undefined> {
  return await redisStorage.getUserBySocketIdFromCache(io, socketId);
}


export const redisStorage = new RedisStorage();


