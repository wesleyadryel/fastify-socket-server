import { redisStorage } from './redis';
import { storageConfig } from './config';

class CleanupManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs = storageConfig.cleanupInterval;

  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, this.cleanupIntervalMs);

    // Cleanup manager started
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      // Cleanup manager stopped
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      const allUsers = await redisStorage.getAllUsers();
      const now = new Date();
      let cleanedCount = 0;

      for (const user of allUsers) {
        const lastSeen = new Date(user.lastSeen);
        const timeDiff = now.getTime() - lastSeen.getTime();
        const maxInactiveTime = storageConfig.maxInactiveTime;

        if (timeDiff > maxInactiveTime) {
          await redisStorage.removeUser(user.socketId);
          cleanedCount++;
          // Cleaned up inactive user
        }
      }

      if (cleanedCount > 0) {
        // Cleanup completed
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async forceCleanup(): Promise<void> {
    // Force cleanup started
    await this.performCleanup();
  }
}

export const cleanupManager = new CleanupManager();
