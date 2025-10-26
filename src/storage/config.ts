export interface StorageConfig {
  useRedis: boolean;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  userKeyPrefix: string;
  userUuidKeyPrefix: string;
  userTokenByUuidKeyPrefix: string;
  roomKeyPrefix: string;
  tempSocketId: string;
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
  userUuidKeyPrefix: process.env.USER_UUID_KEY_PREFIX || 'user-uuid',
  userTokenByUuidKeyPrefix: process.env.USER_TOKEN_BY_UUID_KEY_PREFIX || 'user-token-by-uuid',
  roomKeyPrefix: process.env.ROOM_KEY_PREFIX || 'room',
  tempSocketId: process.env.TEMP_SOCKET_ID || 'temp-socket-id',
  ttl: parseInt(process.env.STORAGE_TTL || '3600')
};

export function getStorageInfo(): { type: string; config: Partial<StorageConfig> } {
  return {
    type: storageConfig.useRedis ? 'Redis' : 'Local Cache',
    config: {
      useRedis: storageConfig.useRedis,
      userKeyPrefix: storageConfig.userKeyPrefix,
      userUuidKeyPrefix: storageConfig.userUuidKeyPrefix,
      userTokenByUuidKeyPrefix: storageConfig.userTokenByUuidKeyPrefix,
      roomKeyPrefix: storageConfig.roomKeyPrefix,
      tempSocketId: storageConfig.tempSocketId,
      ttl: storageConfig.ttl
    }
  };
}
