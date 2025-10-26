import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriberService } from './index';
import { 
  createSubscriberSchema, 
  updateSubscriberSchema, 
  deleteSubscriberSchema,
  createSubscriberWithSchemaSchema
} from '../validation/zod-schemas';
import { fastifyZodPreHandler } from '../validation/zod-utils';
import { redisStorage } from '../storage/redis';
import { subscriberSchemas } from './schemas';
import { authGuard } from '../middleware/auth-guard';

export default async function subscriberApi(fastify: FastifyInstance) {
  
  fastify.post(
    '/subscribers',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.createSubscriber
    },
    async (request, reply) => {
      try {
        const body = request.body as any;
        
        if (Array.isArray(body)) {
          const results = [];
          for (const subscriberData of body) {
            const subscriber = subscriberService.createSubscriber(subscriberData);
            results.push(subscriber);
          }
          return {
            success: true,
            subscribers: results
          };
        } else {
          const subscriber = subscriberService.createSubscriber(body);
          return {
            success: true,
            subscriber
          };
        }
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  fastify.post(
    '/subscribers/with-validation',
    {
      preHandler: [authGuard, fastifyZodPreHandler(createSubscriberWithSchemaSchema)],
      schema: subscriberSchemas.createSubscriberWithValidation
    },
    async (request, reply) => {
      try {
        const subscriber = subscriberService.createSubscriber(request.body as any);
        return {
          success: true,
          subscriber
        };
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  fastify.get(
    '/subscribers',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.getAllSubscribers
    },
    async (request, reply) => {
      try {
        const subscribers = subscriberService.getAllSubscribers();
        return {
          success: true,
          subscribers
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get subscribers',
          details: error.message
        });
      }
    }
  );

  fastify.get(
    '/subscribers/:id',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.getSubscriberById
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const subscriber = subscriberService.getSubscriber(id);
        
        if (!subscriber) {
          return reply.status(404).send({
            success: false,
            error: 'Subscriber not found'
          });
        }
        
        return {
          success: true,
          subscriber
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get subscriber',
          details: error.message
        });
      }
    }
  );

  fastify.put(
    '/subscribers/:id',
    {
      preHandler: [authGuard, fastifyZodPreHandler(updateSubscriberSchema)],
      schema: subscriberSchemas.updateSubscriber
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const subscriber = subscriberService.updateSubscriber(id, request.body as any);
        
        if (!subscriber) {
          return reply.status(404).send({
            success: false,
            error: 'Subscriber not found'
          });
        }
        
        return {
          success: true,
          subscriber
        };
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  fastify.delete(
    '/subscribers/:id',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.deleteSubscriber
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const deleted = subscriberService.deleteSubscriber(id);
        
        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: 'Subscriber not found'
          });
        }
        
        return {
          success: true,
          message: 'Subscriber deleted successfully'
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete subscriber',
          details: error.message
        });
      }
    }
  );

  fastify.delete(
    '/subscribers',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.deleteAllSubscribers
    },
    async (request, reply) => {
      try {
        const deletedCount = subscriberService.deleteAllSubscribers();
        return {
          success: true,
          message: 'All subscribers deleted successfully',
          deletedCount
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete subscribers',
          details: error.message
        });
      }
    }
  );

  fastify.get(
    '/subscribers/event/:eventListener',
    {
      preHandler: [authGuard],
      schema: subscriberSchemas.getSubscriberByEvent
    },
    async (request, reply) => {
      try {
        const { eventListener } = request.params as { eventListener: string };
        const subscriber = subscriberService.findSubscriberByEventListener(eventListener);
        
        if (!subscriber) {
          return reply.status(404).send({
            success: false,
            error: 'Subscriber not found'
          });
        }
        
        return {
          success: true,
          subscriber
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get subscriber',
          details: error.message
        });
      }
    }
  );

  fastify.post('/server/emit', {
    preHandler: [authGuard],
    schema: subscriberSchemas.emitServerEvent
  }, async (request, reply) => {
    try {
      const { eventName, data, roomId, emitToUser, includeSender } = request.body as any;
      const io = fastify.io;
      let clientsCount = 0;
      let targetInfo = '';

      if (emitToUser) {
        const targetUsers = await redisStorage.getUsersByIdentifiers(emitToUser);
        const targetSockets = targetUsers
          .map((user: any) => io.sockets.sockets.get(user.socketId))
          .filter((socket: any) => socket !== undefined);

        for (const socket of targetSockets) {
          if (socket) {
            socket.emit(eventName, data);
          }
        }
        clientsCount = targetSockets.length;
        targetInfo = `specific users (${Object.keys(emitToUser).join(', ')})`;
      } else if (roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
          if (includeSender) {
            io.in(roomId).emit(eventName, data);
          } else {
            io.to(roomId).emit(eventName, data);
          }
          clientsCount = room.size;
          targetInfo = `room ${roomId}`;
        } else {
          return reply.status(404).send({
            success: false,
            error: 'Room not found'
          });
        }
      } else {
        io.emit(eventName, data);
        clientsCount = io.sockets.sockets.size;
        targetInfo = 'all clients';
      }

      return {
        success: true,
        message: `Event '${eventName}' emitted to ${targetInfo}`,
        eventName,
        roomId: roomId || null,
        emitToUser: emitToUser || null,
        clientsCount
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to emit event',
        details: error.message
      });
    }
  });
}
