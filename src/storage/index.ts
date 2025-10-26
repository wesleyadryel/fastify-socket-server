export { redisStorage } from './redis';
export { reconnectionManager } from './reconnection';
export { storageEvents } from './events';
export { storageConfig, getStorageInfo } from './config';
export { disconnectRedis } from './redis-connection';

import { getStorageInfo } from './config';

export async function initializeStorage(): Promise<void> {
  const info = getStorageInfo();
}

export async function shutdownStorage(): Promise<void> {
  const { disconnectRedis } = await import('./redis-connection');
  await disconnectRedis();
}
