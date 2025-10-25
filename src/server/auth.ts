import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { jwtManager } from '../jwt';
import { Log } from '../utils/log';
import { redisStorage } from '../storage/redis';
import { heartbeatManager } from '../storage/heartbeat';

export interface SocketData {
  userId?: string;
  authenticated?: boolean;
  user?: {
    userId?: string;
    userSource?: string;
    [key: string]: any;
  };
}

export const authMiddleware = (
  socket: Socket<any, any, any, SocketData>,
  next: (err?: ExtendedError) => void
) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.token;

  if (!token || typeof token !== 'string') {
    Log.error('Auth Middleware Error: Missing token', {
      handshakeAuth: socket.handshake.auth,
      handshakeQuery: socket.handshake.query,
      handshakeHeaders: socket.handshake.headers,
      socketId: socket.id
    });
    return next(new Error('Authentication token required'));
  }

  try {
    const payload = jwtManager.verify(token);
    // JWT payload received
    
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      throw new Error('Invalid payload');
    }
    
    socket.data.userId = payload.userId;
    socket.data.authenticated = true;
    socket.data.user = payload.identifiers || { userId: payload.userId };
    
    // Store user data in persistent storage using JWT as primary identifier
    redisStorage.updateUser(
      token,
      socket.id,
      payload.userId,
      true,
      payload.identifiers || { userId: payload.userId },
      []
    );
    
    // User authenticated successfully
    
    // Start heartbeat for this user using JWT
    heartbeatManager.startHeartbeat(token);
    
    // Add disconnect handler
    socket.on('disconnect', () => {
      heartbeatManager.stopHeartbeat(token);
      redisStorage.removeUser(token);
      // User disconnected and removed from storage
    });
    
    next();
  } catch (error: any) {
    Log.error('Auth Middleware Error: Invalid or expired token', {
      token,
      error: error?.message,
      handshakeAuth: socket.handshake.auth,
      socketId: socket.id
    });
    next(new Error('Invalid or expired token'));
  }
};
