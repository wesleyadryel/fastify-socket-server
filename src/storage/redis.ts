import Redis from 'ioredis';
import { storageEvents } from './events';
import { storageConfig } from './config';

export interface StoredUser {
  socketId: string;
  userId: string;
  authenticated: boolean;
  user: Record<string, any>;
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

      this.redis.on('connect', () => {});
    }
  }

  private getJWTKey(jwtToken: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(jwtToken).digest('hex');
    return `${storageConfig.userKeyPrefix}:${hash}`;
  }

  async addUser(jwtToken: string, socketId: string, userId: string, authenticated: boolean, user: Record<string, any>, rooms: string[] = []): Promise<void> {
    const userData: StoredUser = {
      socketId,
      userId,
      authenticated,
      user,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      rooms
    };

    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        await this.redis.hset(key, {
          socketId: userData.socketId,
          userId: userData.userId,
          authenticated: userData.authenticated.toString(),
          user: JSON.stringify(userData.user),
          connectedAt: userData.connectedAt,
          lastSeen: userData.lastSeen,
          rooms: JSON.stringify(userData.rooms)
        });
        await this.redis.expire(key, this.ttl);
        storageEvents.emitUserEvent('user_connected', socketId, userId, user);
      } catch (error) {
        console.error('Redis storage error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      storageEvents.emitUserEvent('user_connected', socketId, userId, user);
    }
  }

  async updateUser(jwtToken: string, socketId: string, userId: string, authenticated: boolean, user: Record<string, any>, rooms: string[] = []): Promise<void> {
    const userData: StoredUser = {
      socketId,
      userId,
      authenticated,
      user,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      rooms
    };

    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        await this.redis.hset(key, {
          socketId: userData.socketId,
          userId: userData.userId,
          authenticated: userData.authenticated.toString(),
          user: JSON.stringify(userData.user),
          connectedAt: userData.connectedAt,
          lastSeen: userData.lastSeen,
          rooms: JSON.stringify(userData.rooms)
        });
        await this.redis.expire(key, this.ttl);
        storageEvents.emitUserEvent('user_updated', socketId, userId, user);
      } catch (error) {
        console.error('Redis update error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      storageEvents.emitUserEvent('user_updated', socketId, userId, user);
    }
  }

  async removeUser(jwtToken: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const userData = await this.getUserByJWT(jwtToken);
        if (userData) {
          await this.redis.del(this.getJWTKey(jwtToken));
        }
        if (userData) {
          storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.userId, userData.user);
        }
      } catch (error) {
        console.error('Redis removal error:', error);
        this.localCache.delete(jwtToken);
      }
    } else {
      const userData = this.localCache.get(jwtToken);
      this.localCache.delete(jwtToken);
      if (userData) {
        storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.userId, userData.user);
      }
    }
  }

  async getUserByJWT(jwtToken: string): Promise<StoredUser | undefined> {
    if (this.useRedis && this.redis) {
      try {
        const key = this.getJWTKey(jwtToken);
        const data = await this.redis.hgetall(key);
        if (data && Object.keys(data).length > 0) {
          return {
            socketId: data.socketId,
            userId: data.userId,
            authenticated: data.authenticated === 'true',
            user: JSON.parse(data.user),
            connectedAt: data.connectedAt,
            lastSeen: data.lastSeen,
            rooms: JSON.parse(data.rooms)
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

  async getUserBySocketId(socketId: string): Promise<StoredUser | undefined> {
    const allUsers = await this.getAllUsers();
    return allUsers.find(user => user.socketId === socketId);
  }

  async getAllUsers(): Promise<StoredUser[]> {
    if (this.useRedis && this.redis) {
      try {
        const keys = await this.redis.keys(`${storageConfig.userKeyPrefix}:*`);
        const users: StoredUser[] = [];
        
        for (const key of keys) {
          const data = await this.redis.hgetall(key);
          if (data && Object.keys(data).length > 0) {
            users.push({
              socketId: data.socketId,
              userId: data.userId,
              authenticated: data.authenticated === 'true',
              user: JSON.parse(data.user),
              connectedAt: data.connectedAt,
              lastSeen: data.lastSeen,
              rooms: JSON.parse(data.rooms)
            });
          }
        }
        
        return users;
      } catch (error) {
        console.error('Redis getAllUsers error:', error);
        return Array.from(this.localCache.values());
      }
    } else {
      const users = Array.from(this.localCache.values());
      return users;
    }
  }

  async getUsersByUserId(userId: string): Promise<StoredUser[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => user.userId === userId);
  }

  async getUsersByIdentifiers(identifiers: Record<string, any>): Promise<StoredUser[]> {
    const allUsers = await this.getAllUsers();
    const foundUsers: StoredUser[] = [];
    
    for (const user of allUsers) {
      let match = true;
      for (const key in identifiers) {
        if (identifiers.hasOwnProperty(key)) {
          if (user.user[`${key}`] !== identifiers[key]) {
            match = false;
            break;
          }
        }
      }
      if (match) {
        foundUsers.push(user);
      }
    }
    
    return foundUsers;
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

  async extendUserTTL(jwtToken: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.expire(this.getJWTKey(jwtToken), this.ttl);
      } catch (error) {
        console.error('Redis extendTTL error:', error);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export const redisStorage = new RedisStorage();
