import Redis from 'ioredis';
import { storageConfig } from './config';

class RedisConnection {
  private static instance: Redis | null = null;
  private static isInitialized = false;

  static getInstance(): Redis | null {
    if (!storageConfig.useRedis) {
      return null;
    }

    if (!this.instance && !this.isInitialized) {
      this.isInitialized = true;
      this.instance = new Redis({
        host: storageConfig.redis.host,
        port: storageConfig.redis.port,
        password: storageConfig.redis.password,
        db: storageConfig.redis.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.instance.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.instance.on('connect', () => {
        console.log('Redis connected successfully');
      });
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      this.isInitialized = false;
    }
  }
}

export const getRedisConnection = (): Redis | null => RedisConnection.getInstance();
export const disconnectRedis = (): Promise<void> => RedisConnection.disconnect();

