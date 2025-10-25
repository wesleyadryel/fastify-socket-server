import { redisStorage } from './redis';
import { storageConfig } from './config';

class HeartbeatManager {
  private intervals = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval = storageConfig.heartbeatInterval;

  startHeartbeat(jwtToken: string): void {
    this.stopHeartbeat(jwtToken);
    
    const interval = setInterval(async () => {
      try {
        await redisStorage.extendUserTTL(jwtToken);
      } catch (error) {
        console.error(`Heartbeat error for JWT token:`, error);
      }
    }, this.heartbeatInterval);
    
    this.intervals.set(jwtToken, interval);
  }

  stopHeartbeat(jwtToken: string): void {
    const interval = this.intervals.get(jwtToken);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jwtToken);
    }
  }

  stopAllHeartbeats(): void {
    for (const [socketId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

export const heartbeatManager = new HeartbeatManager();
