import { Socket } from 'socket.io';
import { ZodError } from 'zod';
import { roomIdSchema } from '../validation/zod-schemas';
import { subscriberService } from '../subscribers';
import { EventDataValidator } from '../subscribers/validation';
import { roomStorage } from '../room';
import { Log } from '../utils/log';
import { redisStorage } from '../storage/redis';

export function handleJoinRoom(socket: Socket) {
  socket.on('joinRoom', async (roomId: string, callback?: (response: any) => void) => {
    try {
      const parsed = roomIdSchema.parse({ roomId });
      const userUuid = socket.data.userUuid;

      if (!userUuid) {
        const error = { success: false, error: 'User not authenticated' };
        if (callback) return callback(error);
        throw new Error('User not authenticated');
      }

      const canJoinResult = await roomStorage.canUserJoinRoom(parsed.roomId, userUuid);
      if (!canJoinResult.canJoin) {
        const error = { success: false, error: canJoinResult.reason || 'Cannot join room' };
        if (callback) return callback(error);
        throw new Error(canJoinResult.reason || 'Cannot join room');
      }

      const isMember = await roomStorage.isUserInRoom(parsed.roomId, userUuid);
      if (!isMember) {
        const addResult = await roomStorage.addMemberToRoom(parsed.roomId, userUuid, socket);
        if (!addResult.success) {
          const error = { success: false, error: addResult.message || 'Failed to add user to room' };
          if (callback) return callback(error);
          throw new Error(addResult.message || 'Failed to add user to room');
        }

        socket.to(parsed.roomId).emit('userJoined', {
          userUuid,
          roomId: parsed.roomId,
          timestamp: new Date().toISOString()
        });
      }

      if (callback) callback({ success: true, roomId: parsed.roomId });
    } catch (err) {
      const error = err instanceof ZodError 
        ? { success: false, error: 'Validation error', details: err.issues }
        : { success: false, error: 'Invalid request' };
      
      if (callback) {
        callback(error);
      } else {
        Log.error('Join room error', { error: err, socketId: socket.id });
      }
    }
  });
}

export function handleLeaveRoom(socket: Socket) {
  socket.on('leaveRoom', async (roomId: string, callback?: (response: any) => void) => {
    try {
      const parsed = roomIdSchema.parse({ roomId });
      const userUuid = socket.data.userUuid;

      if (!userUuid) {
        const error = { success: false, error: 'User not authenticated' };
        if (callback) return callback(error);
        throw new Error('User not authenticated');
      }

      socket.leave(parsed.roomId);

      const result = await roomStorage.removeMemberFromRoom(parsed.roomId, userUuid);
      
      socket.to(parsed.roomId).emit('userLeft', {
        userUuid,
        roomId: parsed.roomId,
        timestamp: new Date().toISOString()
      });

      if (!result.success) {
        const error = { success: false, error: result.reason || 'Failed to remove user from room' };
        if (callback) return callback(error);
        Log.warning('Failed to remove user from storage', {
          roomId: parsed.roomId, 
          userUuid,
          reason: result.reason 
        });
        return;
      }

      if (callback) callback({ success: true, data: parsed });
    } catch (err) {
      const error = err instanceof ZodError 
        ? { success: false, error: 'Validation error', details: err.issues }
        : { success: false, error: 'Invalid request' };
      
      if (callback) {
        callback(error);
      } else {
        Log.error('Leave room error', { error: err, socketId: socket.id });
      }
    }
  });
}

export function handleDynamicEvents(socket: Socket) {
  socket.onAny(async (eventName: string, data: any, callback?: (response: any) => void) => {
    const builtInEvents = ['joinRoom', 'leaveRoom', 'disconnect', 'disconnecting', 'connect', 'connect_error'];
    if (builtInEvents.includes(eventName)) {
      return;
    }

    const hasSpecificListener = socket.listenerCount(eventName) > 0;

    if (hasSpecificListener) {
      return;
    }

    try {
      const subscribers = subscriberService.getSubscribersByEvent(eventName);

      if (subscribers.length === 0) {
        if (callback) {
          callback({ success: false, error: `No subscribers found for event: ${eventName}` });
        }
        return;
      }

      const results = await Promise.all(subscribers.map(async (subscriber) => {
        const result = {
          subscriberId: subscriber.id,
          eventListener: subscriber.eventListener,
          replicable: subscriber.replicable,
          processed: true
        };

        if (subscriber.replicable) {
          let sanitizedData = data;

          if (subscriber.parameters && subscriber.parameters.length > 0) {
            try {
              sanitizedData = EventDataValidator.validateAndSanitizeData(data, subscriber.parameters);
            } catch (validationError: any) {
              if (callback) {
                callback({
                  success: false,
                  error: `Validation failed: ${validationError.message}`,
                  subscriberId: subscriber.id
                });
              }
              return result;
            }
          }

          const eventData = {
            ...sanitizedData,
            userUuid: socket.data.userUuid || socket.data.identifiers?.userUuid,
            timestamp: new Date().toISOString(),
            subscriberId: subscriber.id
          };

          if (data.roomId) {
            if (subscriber.includeSender) {
              socket.emit(eventName, eventData);
            }
            socket.to(data.roomId).emit(eventName, eventData);
          } else {
            if (subscriber.includeSender) {
              socket.emit(eventName, eventData);
            }
            socket.broadcast.emit(eventName, eventData);
          }
        }

        return result;
      }));

      if (callback) {
        callback({
          success: true,
          data: {
            event: eventName,
            originalData: data,
            subscribers: results
          }
        });
      }
    } catch (err) {
      Log.error('Dynamic event processing failed', { 
        error: err, 
        eventName, 
        socketId: socket.id 
      });
      if (callback) {
        callback({ success: false, error: 'Event processing failed' });
      }
    }
  });
}

export function handleDisconnect(socket: Socket) {
  socket.on('disconnect', async (reason) => {
    Log.log('Socket disconnected', {
      socketId: socket.id,
      reason,
      userUuid: socket.data.userUuid
    });

    try {
      const userUuid = socket.data.userUuid;
      const token = socket.data.token;

      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      for (const roomId of rooms) {
        if (userUuid) {
          const result = await roomStorage.removeMemberFromRoom(roomId, userUuid, true);
          if (result.success) {
            socket.to(roomId).emit('userLeft', {
              userUuid,
              roomId,
              timestamp: new Date().toISOString(),
              reason: 'disconnected'
            });
          }
        }
        socket.leave(roomId);
      }

      if (token && userUuid) {
        await redisStorage.removeUser(token);
      }
    } catch (error) {
      Log.error('Error during disconnect cleanup', {
        error,
        socketId: socket.id
      });
    }
  });

  socket.on('disconnecting', async (reason) => {
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    const userUuid = socket.data.userUuid;

    if (userUuid && rooms.length > 0) {
      Log.log('Socket disconnecting from rooms', {
        socketId: socket.id,
        rooms,
        userUuid,
        reason
      });
    }
  });
}
