export interface StorageConfig {
  useRedis: boolean;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  userKeyPrefix: string;
  ttl: number;
}

export const storageConfig: StorageConfig = {
  useRedis: process.env.USE_REDIS === 'true',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  userKeyPrefix: process.env.USER_KEY_PREFIX || 'user',
  ttl: 3600
};

export function getStorageInfo(): { type: string; config: Partial<StorageConfig> } {
  return {
    type: storageConfig.useRedis ? 'Redis' : 'Local Cache',
    config: {
      useRedis: storageConfig.useRedis,
      userKeyPrefix: storageConfig.userKeyPrefix,
      ttl: storageConfig.ttl
    }
  };
}
