import { Socket } from 'socket.io';
import { ZodError } from 'zod';
import { roomIdSchema } from '../validation/zod-schemas';
import { subscriberService } from '../subscribers';
import { EventDataValidator } from '../subscribers/validation';
import { roomStorage } from '../room';

// Helper function to safely call callback
function safeCallback(callback: (response: any) => void, response: any) {
  if (callback && typeof callback === 'function') {
    callback(response);
  }
}

export function handleJoinRoom(socket: Socket) {
  socket.on('joinRoom', async (roomId: string, callback?: (response: any) => void) => {
    try {
      const parsed = roomIdSchema.parse({ roomId });
      const userUuid = socket.data.userUuid;

      if (!userUuid) {
        return safeCallback(callback!, { success: false, error: 'User not authenticated' });
      }

      const canJoinResult = await roomStorage.canUserJoinRoom(parsed.roomId, userUuid);
      if (!canJoinResult.canJoin) {
        return safeCallback(callback!, {
          success: false,
          error: canJoinResult.reason || 'Cannot join room'
        });
      }

      const isMember = await roomStorage.isUserInRoom(parsed.roomId, userUuid);
      if (!isMember) {
        const addResult = await roomStorage.addMemberToRoom(parsed.roomId, userUuid, socket);
        if (!addResult.success) {
          return safeCallback(callback!, { success: false, error: addResult.message || 'Failed to add user to room' });
        }
      }

      safeCallback(callback!, { success: true });
    } catch (err) {
      if (err instanceof ZodError) {
        safeCallback(callback!, { success: false, error: 'Validation error', details: err.issues });
      } else {
        safeCallback(callback!, { success: false, error: 'Invalid request' });
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
        return safeCallback(callback!, { success: false, error: 'User not authenticated' });
      }

      const result = await roomStorage.removeMemberFromRoom(parsed.roomId, userUuid);
      if (!result.success) {
        return safeCallback(callback!, { success: false, error: result.reason || 'Failed to remove user from room' });
      }

      safeCallback(callback!, { success: true, data: parsed });
      socket.leave(parsed.roomId);
      socket.to(parsed.roomId).emit('userLeft', {
        userUuid: userUuid,
        roomId: parsed.roomId,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        safeCallback(callback!, { success: false, error: 'Validation error', details: err.issues });
      } else {
        safeCallback(callback!, { success: false, error: 'Invalid request' });
      }
    }
  });
}

export function handleDynamicEvents(socket: Socket) {
  socket.onAny((eventName: string, data: any, callback?: (response: any) => void) => {
    const hasSpecificListener = socket.listenerCount(eventName) > 0;

    if (hasSpecificListener) {
      return;
    }

    try {
      const subscribers = subscriberService.getSubscribersByEvent(eventName);

      if (subscribers.length === 0) {
        return safeCallback(callback!, { success: false, error: `No subscribers found for event: ${eventName}` });
      }

      const results = subscribers.map(subscriber => {
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
              safeCallback(callback!, {
                success: false,
                error: `Validation failed: ${validationError.message}`,
                subscriberId: subscriber.id
              });
              return result;
            }
          }

          const eventData = {
            ...sanitizedData,
            userUuid: socket.data.identifiers?.userUuid,
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
      });

      safeCallback(callback!, {
        success: true,
        data: {
          event: eventName,
          originalData: data
        }
      });

    } catch (err) {
      safeCallback(callback!, { success: false, error: 'Event processing failed' });
    }
  });
}
