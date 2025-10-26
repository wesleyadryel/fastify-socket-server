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
        maxRetriesPerRequest: null, // Retry forever
        lazyConnect: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`Redis attempting to reconnect (attempt ${times}) in ${delay}ms...`);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            console.error('Redis READONLY error, reconnecting...');
            return true;
          }
          return false;
        }
      });

      this.instance.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.instance.on('connect', () => {
        console.log('Redis connected successfully');
      });

      this.instance.on('reconnecting', () => {
        console.log('Redis reconnecting...');
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

