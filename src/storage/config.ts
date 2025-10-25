export interface StorageConfig {
  useRedis: boolean;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  userKeyPrefix: string; // Prefixo para chaves de usuário
  ttl: number; // TTL em segundos
  heartbeatInterval: number; // Intervalo do heartbeat em ms
  cleanupInterval: number; // Intervalo de limpeza em ms
  maxInactiveTime: number; // Tempo máximo de inatividade em ms
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
  ttl: parseInt(process.env.STORAGE_TTL || '3600'), // 1 hora por padrão
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '300000'), // 5 minutos
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '600000'), // 10 minutos
  maxInactiveTime: parseInt(process.env.MAX_INACTIVE_TIME || '1800000') // 30 minutos
};

export function getStorageInfo(): { type: string; config: Partial<StorageConfig> } {
  return {
    type: storageConfig.useRedis ? 'Redis' : 'Local Cache',
    config: {
      useRedis: storageConfig.useRedis,
      userKeyPrefix: storageConfig.userKeyPrefix,
      ttl: storageConfig.ttl,
      heartbeatInterval: storageConfig.heartbeatInterval,
      cleanupInterval: storageConfig.cleanupInterval,
      maxInactiveTime: storageConfig.maxInactiveTime
    }
  };
}
