// Export all storage modules
export { redisStorage } from './redis';
export { heartbeatManager } from './heartbeat';
export { reconnectionManager } from './reconnection';
export { cleanupManager } from './cleanup';
export { healthMonitor } from './health';
export { storageEvents } from './events';
export { storageConfig, getStorageInfo } from './config';

// Import for internal use
import { redisStorage } from './redis';
import { heartbeatManager } from './heartbeat';
import { cleanupManager } from './cleanup';
import { healthMonitor } from './health';
import { getStorageInfo } from './config';

// Initialize storage system
export async function initializeStorage(): Promise<void> {
  // Initializing storage system
  
  const info = getStorageInfo();
  // Storage type and configuration
  
  // Start all managers
  heartbeatManager.startHeartbeat('system-init');
  cleanupManager.startCleanup();
  healthMonitor.startMonitoring();
  
  // Storage system initialized successfully
}

// Graceful shutdown
export async function shutdownStorage(): Promise<void> {
  // Shutting down storage system
  
  heartbeatManager.stopAllHeartbeats();
  cleanupManager.stopCleanup();
  healthMonitor.stopMonitoring();
  await redisStorage.disconnect();
  
  // Storage system shutdown complete
}
