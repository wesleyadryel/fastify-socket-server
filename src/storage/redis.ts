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

      this.redis.on('connect', () => {
        console.log('Connected to Redis');
      });
    } else {
      console.log('Using local cache storage');
    }
  }

  private getJWTKey(jwtToken: string): string {
    // Usar hash do JWT para evitar caracteres especiais na chave
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(jwtToken).digest('hex');
    return `user:${hash}`;
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
        // Armazenar apenas por JWT (chave única)
        await this.redis.setex(this.getJWTKey(jwtToken), this.ttl, JSON.stringify(userData));
        console.log(`User ${userId} stored in Redis with JWT token`);
        storageEvents.emitUserEvent('user_connected', socketId, userId, user);
      } catch (error) {
        console.error('Redis storage error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      console.log(`User ${userId} stored in local cache with JWT token`);
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
        await this.redis.setex(this.getJWTKey(jwtToken), this.ttl, JSON.stringify(userData));
        console.log(`User ${userId} updated in Redis with JWT token`);
        storageEvents.emitUserEvent('user_updated', socketId, userId, user);
      } catch (error) {
        console.error('Redis update error:', error);
        this.localCache.set(jwtToken, userData);
      }
    } else {
      this.localCache.set(jwtToken, userData);
      console.log(`User ${userId} updated in local cache with JWT token`);
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
        console.log(`User with JWT token removed from Redis`);
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
      console.log(`User with JWT token removed from local cache`);
      if (userData) {
        storageEvents.emitUserEvent('user_disconnected', userData.socketId, userData.userId, userData.user);
      }
    }
  }

  async getUserByJWT(jwtToken: string): Promise<StoredUser | undefined> {
    if (this.useRedis && this.redis) {
      try {
        const data = await this.redis.get(this.getJWTKey(jwtToken));
        if (data) {
          return JSON.parse(data);
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
    // Buscar por iteração em todos os usuários (simples e direto)
    const allUsers = await this.getAllUsers();
    return allUsers.find(user => user.socketId === socketId);
  }

  async getAllUsers(): Promise<StoredUser[]> {
    if (this.useRedis && this.redis) {
      try {
        const keys = await this.redis.keys('user:*');
        const users: StoredUser[] = [];
        
        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            users.push(JSON.parse(data));
          }
        }
        
        console.log(`Retrieved ${users.length} users from Redis`);
        return users;
      } catch (error) {
        console.error('Redis getAllUsers error:', error);
        return Array.from(this.localCache.values());
      }
    } else {
      const users = Array.from(this.localCache.values());
      console.log(`Retrieved ${users.length} users from local cache`);
      return users;
    }
  }

  async getUsersByUserId(userId: string): Promise<StoredUser[]> {
    // Buscar por iteração em todos os usuários (simples e direto)
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
          await this.redis.setex(this.getJWTKey(jwtToken), this.ttl, JSON.stringify(user));
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
