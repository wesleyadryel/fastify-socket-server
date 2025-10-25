export { redisStorage } from './redis';
export { heartbeatManager } from './heartbeat';
export { reconnectionManager } from './reconnection';
export { cleanupManager } from './cleanup';
export { healthMonitor } from './health';
export { storageEvents } from './events';
export { storageConfig, getStorageInfo } from './config';

import { redisStorage } from './redis';
import { heartbeatManager } from './heartbeat';
import { cleanupManager } from './cleanup';
import { healthMonitor } from './health';
import { getStorageInfo } from './config';

export async function initializeStorage(): Promise<void> {
  const info = getStorageInfo();
  
  heartbeatManager.startHeartbeat('system-init');
  cleanupManager.startCleanup();
  healthMonitor.startMonitoring();
}

export async function shutdownStorage(): Promise<void> {
  heartbeatManager.stopAllHeartbeats();
  cleanupManager.stopCleanup();
  healthMonitor.stopMonitoring();
  await redisStorage.disconnect();
}
