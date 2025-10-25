import { Server } from 'socket.io';
import { redisStorage } from './redis';

class ReconnectionManager {
  private io: Server | null = null;

  setIO(io: Server): void {
    this.io = io;
  }

  async handleReconnection(jwtToken: string, socketId: string, userId: string): Promise<boolean> {
    try {
      // Check if user exists in storage by JWT
      const storedUser = await redisStorage.getUserByJWT(jwtToken);
      if (!storedUser) {
        // No stored user found
        return false;
      }

      // Verify user ID matches
      if (storedUser.userId !== userId) {
        // User ID mismatch
        return false;
      }

      // Update socket data with stored information
      if (this.io) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.data.userId = storedUser.userId;
          socket.data.authenticated = storedUser.authenticated;
          socket.data.user = storedUser.user;

          // Join stored rooms
          for (const room of storedUser.rooms) {
            socket.join(room);
          }

          // User reconnected and restored to rooms
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Reconnection error for JWT token:`, error);
      return false;
    }
  }

  async getStoredUserData(jwtToken: string): Promise<any> {
    try {
      return await redisStorage.getUserByJWT(jwtToken);
    } catch (error) {
      console.error(`Error getting stored user data for JWT token:`, error);
      return null;
    }
  }

  async isUserStored(userId: string): Promise<boolean> {
    try {
      const users = await redisStorage.getUsersByUserId(userId);
      return users.length > 0;
    } catch (error) {
      console.error(`Error checking if user ${userId} is stored:`, error);
      return false;
    }
  }
}

export const reconnectionManager = new ReconnectionManager();
