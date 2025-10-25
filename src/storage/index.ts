export { redisStorage } from './redis';
export { reconnectionManager } from './reconnection';
export { storageEvents } from './events';
export { storageConfig, getStorageInfo } from './config';

import { redisStorage } from './redis';
import { getStorageInfo } from './config';

export async function initializeStorage(): Promise<void> {
  const info = getStorageInfo();
}

export async function shutdownStorage(): Promise<void> {
  await redisStorage.disconnect();
}
