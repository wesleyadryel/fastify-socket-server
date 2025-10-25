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

  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
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
        }
      }

      if (cleanedCount > 0) {
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }
}

export const cleanupManager = new CleanupManager();
