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
  console.log('🚀 Initializing storage system...');
  
  const info = getStorageInfo();
  console.log(`📦 Storage type: ${info.type}`);
  console.log(`⚙️  Configuration:`, info.config);
  
  // Start all managers
  heartbeatManager.startHeartbeat('system-init');
  cleanupManager.startCleanup();
  healthMonitor.startMonitoring();
  
  console.log('✅ Storage system initialized successfully');
}

// Graceful shutdown
export async function shutdownStorage(): Promise<void> {
  console.log('🛑 Shutting down storage system...');
  
  heartbeatManager.stopAllHeartbeats();
  cleanupManager.stopCleanup();
  healthMonitor.stopMonitoring();
  await redisStorage.disconnect();
  
  console.log('✅ Storage system shutdown complete');
}
