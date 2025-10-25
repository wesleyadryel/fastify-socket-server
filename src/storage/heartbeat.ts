import { redisStorage } from './redis';
import { storageConfig } from './config';

class HeartbeatManager {
  private intervals = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval = storageConfig.heartbeatInterval;

  startHeartbeat(jwtToken: string): void {
    // Clear existing heartbeat if any
    this.stopHeartbeat(jwtToken);
    
    // Start new heartbeat
    const interval = setInterval(async () => {
      try {
        await redisStorage.extendUserTTL(jwtToken);
        console.log(`Heartbeat extended for JWT token`);
      } catch (error) {
        console.error(`Heartbeat error for JWT token:`, error);
      }
    }, this.heartbeatInterval);
    
    this.intervals.set(jwtToken, interval);
    console.log(`Heartbeat started for JWT token`);
  }

  stopHeartbeat(jwtToken: string): void {
    const interval = this.intervals.get(jwtToken);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jwtToken);
      console.log(`Heartbeat stopped for JWT token`);
    }
  }

  stopAllHeartbeats(): void {
    for (const [socketId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    console.log('All heartbeats stopped');
  }
}

export const heartbeatManager = new HeartbeatManager();
