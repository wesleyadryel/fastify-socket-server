import { EventEmitter } from 'events';

export interface UserEvent {
  type: 'user_connected' | 'user_disconnected' | 'user_reconnected' | 'user_updated';
  socketId: string;
  userId: string;
  user: Record<string, any>;
  timestamp: string;
}

class StorageEventEmitter extends EventEmitter {
  emitUserEvent(type: UserEvent['type'], socketId: string, userId: string, user: Record<string, any>): void {
    const event: UserEvent = {
      type,
      socketId,
      userId,
      user,
      timestamp: new Date().toISOString()
    };

    this.emit('user_event', event);
    this.emit(type, event);
    
    console.log(`Storage event emitted: ${type} for user ${userId} (socketId: ${socketId})`);
  }

  onUserEvent(callback: (event: UserEvent) => void): void {
    this.on('user_event', callback);
  }

  onUserConnected(callback: (event: UserEvent) => void): void {
    this.on('user_connected', callback);
  }

  onUserDisconnected(callback: (event: UserEvent) => void): void {
    this.on('user_disconnected', callback);
  }

  onUserReconnected(callback: (event: UserEvent) => void): void {
    this.on('user_reconnected', callback);
  }

  onUserUpdated(callback: (event: UserEvent) => void): void {
    this.on('user_updated', callback);
  }
}

export const storageEvents = new StorageEventEmitter();
