import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { jwtManager } from '../jwt';
import { Log } from '../utils/log';
import { redisStorage } from '../storage/redis';

export interface SocketData {
  authenticated?: boolean;
  identifiers?: {
    userId?: string;
    userSource?: string;
    [key: string]: any;
  };
  userUuid?: string;
}

export const authMiddleware = async (
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
    
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      throw new Error('Invalid payload');
    }

    const userExists = await redisStorage.getUserByJWT(token);
    if (!userExists) {
      throw new Error('Token not found in storage - user may have been disconnected');
    }
    
    socket.data.authenticated = true;
    socket.data.identifiers = payload.identifiers || { userId: payload.userId };
    socket.data.userUuid = payload.identifiers?.userUuid || payload.identifiers?.userUuid;
    
    // Store user data in persistent storage using JWT as primary identifier
    redisStorage.updateUser(
      token,
      socket.id,
      true,
      payload.identifiers || { userId: payload.userId },
      []
    );

    const userUuid = payload.identifiers?.userUuid || payload.identifiers?.userUuid;
    if (userUuid) {
      await redisStorage.whenConnected(socket.id, userUuid);
    }
    
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
