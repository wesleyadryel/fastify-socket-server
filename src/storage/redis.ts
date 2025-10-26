import Redis from 'ioredis';
import { storageEvents } from './events';
import { storageConfig } from './config';

export interface StoredUser {
  socketId: string;
  authenticated: boolean;
  identifiers: Record<string, any>;
  connectedAt: string;
  lastSeen: string;
  rooms: string[];
}

class RedisStorage {
  private redis: Redis | null = null;
  private useRedis: boolean;
  private localCache = new Map<string, StoredUser>();
  private ttl = storageConfig.ttl;

  constructor() {
    this.useRedis = storageConfig.useRedis;

    if (this.useRedis) {
      this.redis = new Redis({
        host: storageConfig.redis.host,
        port: storageConfig.redis.port,
        password: storageConfig.redis.password,
        db: storageConfig.redis.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.redis.on('connect', () => { });
    }
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

  async addUser(jwtToken: string, socketId: string, authenticated: boolean, identifiers: Record<string, any>, rooms: string[] = []): Promise<void> {
    const userData: StoredUser = {
      socketId,
      authenticated,
      identifiers,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      rooms
    };

    this.localCache.set(jwtToken, userData);

    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        const identifiersJson = JSON.stringify(userData.identifiers);

        await this.redis.hset(key, {
          socketId: userData.socketId,
          authenticated: userData.authenticated.toString(),
          identifiers: identifiersJson,
          connectedAt: userData.connectedAt,
          lastSeen: userData.lastSeen,
          rooms: JSON.stringify(userData.rooms)
        });
        await this.redis.expire(key, this.ttl);

        const socketToJWTKey = this.getSocketIdToJWTKey(socketId);
        await this.redis.set(socketToJWTKey, jwtToken, 'EX', this.ttl);

        storageEvents.emitUserEvent('user_connected', socketId, identifiers.userUuid || '', identifiers);
        
        await this.updateUserIndexes(userData);
      } catch (error) {
        console.error('Redis storage error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      storageEvents.emitUserEvent('user_connected', socketId, identifiers.userUuid || '', identifiers);
    }
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

    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        await this.redis.hset(key, {
          socketId: userData.socketId,
          authenticated: userData.authenticated.toString(),
          identifiers: JSON.stringify(userData.identifiers),
          connectedAt: userData.connectedAt,
          lastSeen: userData.lastSeen,
          rooms: JSON.stringify(userData.rooms)
        });
        await this.redis.expire(key, this.ttl);

        const socketToJWTKey = this.getSocketIdToJWTKey(socketId);
        await this.redis.set(socketToJWTKey, jwtToken, 'EX', this.ttl);

        storageEvents.emitUserEvent('user_updated', socketId, identifiers.userUuid || '', identifiers);
        
        await this.updateUserIndexes(userData);
      } catch (error) {
        console.error('Redis update error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      storageEvents.emitUserEvent('user_updated', socketId, identifiers.userUuid || '', identifiers);
    }
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
        
        await this.removeUserIndexes(userData);
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
    try {

      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.data && socket.data.authenticated) {

        const user = await this.getUserByJWT(socket.data.token || '');
        if (user) {

          user.socketId = socket.id;
          return user;
        }
      }
      

      return await this.getUserBySocketId(socketId);
    } catch (error) {
      console.error('Redis getUserBySocketIdFromCache error:', error);
      return await this.getUserBySocketId(socketId);
    }
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

    return Array.from(this.localCache.values()).filter(user => {
      for (const key in identifiers) {
        if (identifiers.hasOwnProperty(key)) {
          if (user.identifiers[key] !== identifiers[key]) {
            return false;
          }
        }
      }
      return true;
    });
  }


  async getUsersByIdentifiersAdvanced(identifiers: Record<string, any>): Promise<StoredUser[]> {
    if (this.useRedis && this.redis) {
      try {
        const keys = Object.keys(identifiers);
        

        if (keys.length === 1) {
          const key = keys[0];
          const value = identifiers[key];
          
          switch (key) {
            case 'userUuid':
              const jwtToken = await this.getUserTokenByUuid(value);
              if (jwtToken) {
                const user = await this.getUserByJWT(jwtToken);
                return user ? [user] : [];
              }
              return [];
              
            default:
              return Array.from(this.localCache.values()).filter(user => user.identifiers[key] === value);
          }
        }


        const indexKeys: string[] = [];
        const pipeline = this.redis.pipeline();
        
        for (const [key, value] of Object.entries(identifiers)) {
          const indexKey = `user-index:${key}:${value}`;
          indexKeys.push(indexKey);
          pipeline.smembers(indexKey);
        }
        
        const results = await pipeline.exec();
        if (!results || results.length === 0) {
          return Array.from(this.localCache.values()).filter(user => {
            for (const [key, value] of Object.entries(identifiers)) {
              if (user.identifiers[key] !== value) return false;
            }
            return true;
          });
        }


        let intersection: string[] = [];
        for (let i = 0; i < results.length; i++) {
          const [err, userIds] = results[i] as [Error | null, string[]];
          if (!err && userIds) {
            if (i === 0) {
              intersection = userIds;
            } else {
              intersection = intersection.filter(id => userIds.includes(id));
            }
          }
        }


        const users: StoredUser[] = [];
        for (const userId of intersection) {
          const jwtToken = await this.getUserTokenByUuid(userId);
          if (jwtToken) {
            const user = await this.getUserByJWT(jwtToken);
            if (user) {

              let matches = true;
              for (const [key, value] of Object.entries(identifiers)) {
                if (user.identifiers[key] !== value) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                users.push(user);
              }
            }
          }
        }

        return users;
      } catch (error) {
        console.error('Redis getUsersByIdentifiersAdvanced error:', error);
        return Array.from(this.localCache.values()).filter(user => {
          for (const [key, value] of Object.entries(identifiers)) {
            if (user.identifiers[key] !== value) return false;
          }
          return true;
        });
      }
    } else {
      return Array.from(this.localCache.values()).filter(user => {
        for (const [key, value] of Object.entries(identifiers)) {
          if (user.identifiers[key] !== value) return false;
        }
        return true;
      });
    }
  }


  private async updateUserIndexes(user: StoredUser): Promise<void> {
    if (!this.useRedis || !this.redis) return;

    try {
      const pipeline = this.redis.pipeline();
      

      for (const [key, value] of Object.entries(user.identifiers)) {
        if (value !== undefined && value !== null) {
          const indexKey = `user-index:${key}:${value}`;
          pipeline.sadd(indexKey, user.identifiers.userUuid || '');
          pipeline.expire(indexKey, this.ttl);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Redis updateUserIndexes error:', error);
    }
  }


  private async removeUserIndexes(user: StoredUser): Promise<void> {
    if (!this.useRedis || !this.redis) return;

    try {
      const pipeline = this.redis.pipeline();
      

      for (const [key, value] of Object.entries(user.identifiers)) {
        if (value !== undefined && value !== null) {
          const indexKey = `user-index:${key}:${value}`;
          pipeline.srem(indexKey, user.identifiers.userUuid || '');
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Redis removeUserIndexes error:', error);
    }
  }

  async getUserByJWTToken(jwtToken: string): Promise<StoredUser | undefined> {
    return await this.getUserByJWT(jwtToken);
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
        const keys = await this.redis.keys(`${storageConfig.userKeyPrefix}:*`);
        for (const key of keys) {
          const data = await this.redis.hgetall(key);
          if (data && data.socketId === userToRemove.socketId) {
            await this.redis.del(key);
            storageEvents.emitUserEvent('user_disconnected', userToRemove.socketId, userToRemove.identifiers.userUuid || '', userToRemove.identifiers);
            return true;
          }
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


        const keys = await this.redis.keys(`${storageConfig.userKeyPrefix}:*`);
        let userData: StoredUser | null = null;

        for (const key of keys) {
          const data = await this.redis.hgetall(key);
          if (data && data.socketId === socketId) {
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

            userData = {
              socketId: data.socketId,
              authenticated: data.authenticated === 'true',
              identifiers: identifiersData,
              connectedAt: data.connectedAt,
              lastSeen: data.lastSeen,
              rooms: roomsData
            };
            break;
          }
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
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export async function getSocketClientByUuid(userUuid: string, io: any): Promise<{ socket: any | null; userData: StoredUser | null; isConnected: boolean } | null> {
  return await redisStorage.getSocketClientByUuid(userUuid, io);
}

export async function getUserBySocketIdFromCache(io: any, socketId: string): Promise<StoredUser | undefined> {
  return await redisStorage.getUserBySocketIdFromCache(io, socketId);
}


export const redisStorage = new RedisStorage();


