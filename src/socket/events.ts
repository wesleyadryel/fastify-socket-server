import { Socket } from 'socket.io';
import { ZodError } from 'zod';
import { messageDataSchema, roomIdSchema } from '../validation/zod-schemas';

export function handleSendMessage(socket: Socket) {
  socket.on('sendMessage', (data: any, callback: (response: any) => void) => {
    try {
      const parsed = messageDataSchema.parse(data);
      callback({ success: true, data: parsed });
      if (parsed.roomId) {
        socket.to(parsed.roomId).emit('messageReceived', {
          ...parsed,
          userId: socket.data.userId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (err instanceof ZodError) {
        callback({ success: false, error: 'Validation error', details: err.issues });
      } else {
        callback({ success: false, error: 'Invalid request' });
      }
    }
  });
}

export function handleJoinRoom(socket: Socket) {
  socket.on('joinRoom', (roomId: string, callback: (response: any) => void) => {
    try {
      const parsed = roomIdSchema.parse({ roomId });
      callback({ success: true, data: parsed });
      socket.join(parsed.roomId);
      socket.to(parsed.roomId).emit('userJoined', {
        userId: socket.data.userId,
        roomId: parsed.roomId,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        callback({ success: false, error: 'Validation error', details: err.issues });
      } else {
        callback({ success: false, error: 'Invalid request' });
      }
    }
  });
}

export function handleLeaveRoom(socket: Socket) {
  socket.on('leaveRoom', (roomId: string, callback: (response: any) => void) => {
    try {
      const parsed = roomIdSchema.parse({ roomId });
      callback({ success: true, data: parsed });
      socket.leave(parsed.roomId);
      socket.to(parsed.roomId).emit('userLeft', {
        userId: socket.data.userId,
        roomId: parsed.roomId,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        callback({ success: false, error: 'Validation error', details: err.issues });
      } else {
        callback({ success: false, error: 'Invalid request' });
      }
    }
  });
}
