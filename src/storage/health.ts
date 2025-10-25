import { redisStorage } from './redis';
import { storageConfig } from './config';

export interface StorageHealth {
  isHealthy: boolean;
  storageType: 'redis' | 'local';
  totalUsers: number;
  lastCheck: string;
  errors?: string[];
}

class HealthMonitor {
  private lastHealthCheck: StorageHealth | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs = 30 * 1000; // 30 segundos (fixo para health check)

  startMonitoring(): void {
    if (this.checkInterval) {
      return; // Already running
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, this.checkIntervalMs);

    // Health monitoring started
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      // Health monitoring stopped
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const allUsers = await redisStorage.getAllUsers();
      const health: StorageHealth = {
        isHealthy: true,
        storageType: storageConfig.useRedis ? 'redis' : 'local',
        totalUsers: allUsers.length,
        lastCheck: new Date().toISOString()
      };

      this.lastHealthCheck = health;
      // Health check completed
    } catch (error) {
      const health: StorageHealth = {
        isHealthy: false,
        storageType: storageConfig.useRedis ? 'redis' : 'local',
        totalUsers: 0,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      this.lastHealthCheck = health;
      console.error('Health check failed:', error);
    }
  }

  getLastHealthCheck(): StorageHealth | null {
    return this.lastHealthCheck;
  }

  async getCurrentHealth(): Promise<StorageHealth> {
    await this.performHealthCheck();
    return this.lastHealthCheck!;
  }
}

export const healthMonitor = new HealthMonitor();
