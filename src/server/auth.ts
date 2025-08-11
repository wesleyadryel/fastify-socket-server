import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { SocketData } from '../types';
import { jwtManager } from '../jwt';
import { Log } from '../utils/log';

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
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      throw new Error('Invalid payload');
    }
    socket.data.userId = payload.userId;
    socket.data.authenticated = true;
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
