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
    return `${storageConfig.userTokenByUuidKeyPrefix}:${userUuid}`;
  }

  private getSocketIdToJWTKey(socketId: string): string {
    return `socket-to-jwt:${socketId}`;
  }

  private async saveUserData(jwtToken: string, userData: StoredUser, eventType: 'user_connected' | 'user_updated', identifiers: Record<string, any>): Promise<void> {
    if (!this.useRedis || !this.redis) {
      storageEvents.emitUserEvent(eventType, userData.socketId, identifiers.userUuid || '', identifiers);
      return;
    }

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
      storageEvents.emitUserEvent('user_updated', socketId, identifiers.userUuid || '', identifiers);
      return;
    }

    await this.saveUserData(jwtToken, userData, 'user_updated', identifiers);
  }

  async removeUser(jwtToken: string): Promise<void> {
    if (!this.useRedis || !this.redis) {
      return;
    }

    try {
      const userData = await this.getUserByJWT(jwtToken);
      if (!userData) {
        return;
      }

      const pipeline = this.redis.pipeline();
      const key = this.getJWTKey(jwtToken);
      pipeline.del(key);

      const userUuid = userData.identifiers.userUuid;
      if (userUuid) {
        const uuidKey = this.getUserUuidKey(userUuid);
        const tokenKey = this.getKeyUserTokenByUuid(userUuid);
        pipeline.del(uuidKey);
        pipeline.del(tokenKey);
      }

      const socketToJWTKey = this.getSocketIdToJWTKey(userData.socketId);
      pipeline.del(socketToJWTKey);

      await pipeline.exec();
      
      storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.identifiers.userUuid || '', userData.identifiers);
    } catch (error) {
      console.error('Redis removal error:', error);
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
    if (!this.useRedis || !this.redis) {
      return undefined;
    }

    try {
      const key = this.getJWTKey(jwtToken);
      const data = await this.redis.hgetall(key);
      if (!data || Object.keys(data).length === 0) {
        return undefined;
      }

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
    } catch (error) {
      console.error('Redis get error:', error);
      return undefined;
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
    if (!this.useRedis || !this.redis) {
      return undefined;
    }

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


  async getUsersByIdentifiers(identifiers: Record<string, any>): Promise<StoredUser[]> {
    if (identifiers.userUuid) {
      const jwtToken = await this.getUserTokenByUuid(identifiers.userUuid);
      if (jwtToken) {
        const user = await this.getUserByJWT(jwtToken);
        return user ? [user] : [];
      }
      return [];
    }

    return [];
  }




  async updateUserRooms(jwtToken: string, rooms: string[]): Promise<void> {
    if (!this.useRedis || !this.redis) {
      return;
    }

    const user = await this.getUserByJWT(jwtToken);
    if (!user) {
      return;
    }

    user.rooms = rooms;
    user.lastSeen = new Date().toISOString();

    try {
      const key = this.getJWTKey(jwtToken);
      await this.redis.hset(key, {
        rooms: JSON.stringify(rooms),
        lastSeen: user.lastSeen
      });
      await this.redis.expire(key, this.ttl);
    } catch (error) {
      console.error('Redis updateUserRooms error:', error);
    }
  }

  async removeUserByUuid(userUuid: string): Promise<boolean> {
    if (!this.useRedis || !this.redis) {
      return false;
    }

    try {
      const uuidKey = this.getUserUuidKey(userUuid);
      const tokenKey = this.getKeyUserTokenByUuid(userUuid);
      
      const pipeline = this.redis.pipeline();
      pipeline.get(uuidKey);
      pipeline.get(tokenKey);
      const results = await pipeline.exec();
      
      if (!results || results.length < 2) {
        return false;
      }

      const socketId = results[0][1] as string | null;
      const jwtToken = results[1][1] as string | null;
      
      if (!socketId || !jwtToken) {
        return false;
      }

      await this.removeUser(jwtToken);
      
      return true;
    } catch (error) {
      console.error('Redis removeUserByUuid error:', error);
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
    if (!this.useRedis || !this.redis) {
      return null;
    }

    try {
      const uuidKey = this.getUserUuidKey(userUuid);
      const tokenKey = this.getKeyUserTokenByUuid(userUuid);
      
      const pipeline = this.redis.pipeline();
      pipeline.get(uuidKey);
      pipeline.get(tokenKey);
      const results = await pipeline.exec();
      
      if (!results || results.length < 2) {
        return null;
      }

      const socketId = results[0][1] as string | null;
      const jwtToken = results[1][1] as string | null;
      
      if (!socketId) {
        return null;
      }

      const socket = io.sockets.sockets.get(socketId);
      const isConnected = !!socket;

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


