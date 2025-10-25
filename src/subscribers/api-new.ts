import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriberService } from './index';
import { 
  createSubscriberSchema, 
  updateSubscriberSchema, 
  deleteSubscriberSchema,
  createSubscriberWithSchemaSchema
} from '../validation/zod-schemas';
import { fastifyZodPreHandler } from '../validation/zod-utils';

async function authGuard(request: FastifyRequest, reply: FastifyReply) {  
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token not provided' });
  }
  const token = authHeader.split(' ')[1];
  const API_TOKEN = process.env.API_TOKEN;
  if (!API_TOKEN) {
    return reply.status(500).send({ error: 'API_TOKEN not configured on server' });
  }
  if (token !== API_TOKEN) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

export default async function subscriberApi(fastify: FastifyInstance) {
  
  fastify.post(
    '/subscribers',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Create one or multiple event subscribers',
        summary: 'Create Subscribers',
        tags: ['Event Subscribers'],
        body: {
          oneOf: [
            {
              type: 'object',
              properties: {
                eventListener: { type: 'string', description: 'Event listener name' },
                replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
                includeSender: { type: 'boolean', description: 'Whether the sender should also receive the replicated event' },
                description: { type: 'string', description: 'Optional description' }
              },
              required: ['eventListener']
            },
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  eventListener: { type: 'string', description: 'Event listener name' },
                  replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
                  includeSender: { type: 'boolean', description: 'Whether the sender should also receive the replicated event' },
                  description: { type: 'string', description: 'Optional description' }
                },
                required: ['eventListener']
              }
            }
          ]
        },
        response: {
          200: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  subscriber: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      eventListener: { type: 'string' },
                      replicable: { type: 'boolean' },
                      includeSender: { type: 'boolean' },
                      description: { type: 'string', nullable: true },
                      createdAt: { type: 'string' }
                    }
                  }
                }
              },
              {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  subscribers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        eventListener: { type: 'string' },
                        replicable: { type: 'boolean' },
                        includeSender: { type: 'boolean' },
                        description: { type: 'string', nullable: true },
                        createdAt: { type: 'string' }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      }
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
      schema: {
        description: 'Create subscriber with parameter validation schema',
        summary: 'Create Subscriber with Validation',
        tags: ['Event Subscribers'],
        body: createSubscriberWithSchemaSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriber: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  parameters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                        sanitize: { type: 'boolean' }
                      }
                    }
                  },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const subscriber = subscriberService.createSubscriber(request.body);
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
      schema: {
        description: 'Get all event subscribers',
        summary: 'Get All Subscribers',
        tags: ['Event Subscribers'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscribers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    eventListener: { type: 'string' },
                    replicable: { type: 'boolean' },
                    includeSender: { type: 'boolean' },
                    description: { type: 'string', nullable: true },
                    parameters: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          type: { type: 'string' },
                          required: { type: 'boolean' },
                          sanitize: { type: 'boolean' }
                        }
                      }
                    },
                    createdAt: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
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
      schema: {
        description: 'Get subscriber by ID',
        summary: 'Get Subscriber by ID',
        tags: ['Event Subscribers'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriber: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  parameters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                        sanitize: { type: 'boolean' }
                      }
                    }
                  },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const subscriber = subscriberService.getSubscriberById(id);
        
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
      schema: {
        description: 'Update subscriber by ID',
        summary: 'Update Subscriber',
        tags: ['Event Subscribers'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        body: updateSubscriberSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriber: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  parameters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                        sanitize: { type: 'boolean' }
                      }
                    }
                  },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const subscriber = subscriberService.updateSubscriber(id, request.body);
        
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
      schema: {
        description: 'Delete subscriber by ID',
        summary: 'Delete Subscriber',
        tags: ['Event Subscribers'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
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
      schema: {
        description: 'Delete all subscribers',
        summary: 'Delete All Subscribers',
        tags: ['Event Subscribers'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              deletedCount: { type: 'number' }
            }
          }
        }
      }
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
      schema: {
        description: 'Get subscriber by event listener name',
        summary: 'Get Subscriber by Event',
        tags: ['Event Subscribers'],
        params: {
          type: 'object',
          properties: {
            eventListener: { type: 'string' }
          },
          required: ['eventListener']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriber: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  parameters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                        sanitize: { type: 'boolean' }
                      }
                    }
                  },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { eventListener } = request.params as { eventListener: string };
        const subscriber = subscriberService.getSubscriberByEventListener(eventListener);
        
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

  // Server emit route
  fastify.post('/server/emit', {
    preHandler: [authGuard],
    schema: {
      description: 'Emit an event to socket clients from the server',
      summary: 'Emit Server Event',
      tags: ['Server Events'],
      body: {
        type: 'object',
        properties: {
          eventName: { type: 'string', description: 'Name of the event to emit' },
          data: { type: 'object', description: 'Data to send with the event' },
          roomId: { type: 'string', description: 'Specific room ID (optional - if not provided, emits to all clients)' },
          emitToUser: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'Target user by userId' },
              userSource: { type: 'string', description: 'Target user by userSource' }
            }
          },
          includeSender: { type: 'boolean', description: 'Whether to include the sender in the broadcast' }
        },
        required: ['eventName', 'data']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            eventName: { type: 'string' },
            roomId: { type: 'string', nullable: true },
            emitToUser: { type: 'object', nullable: true },
            clientsCount: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { eventName, data, roomId, emitToUser, includeSender } = request.body as any;
      const io = fastify.io;
      let clientsCount = 0;
      let targetInfo = '';

      if (emitToUser) {
        const targetUsers = await redisStorage.getUsersByIdentifiers(emitToUser);
        const targetSockets = targetUsers
          .map(user => io.sockets.sockets.get(user.socketId))
          .filter(socket => socket !== undefined);

        for (const socket of targetSockets) {
          socket.emit(eventName, data);
        }
        clientsCount = targetSockets.length;
        targetInfo = `specific users (${Object.keys(emitToUser).join(', ')})`;
      } else if (roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
          if (includeSender) {
            io.to(roomId).emit(eventName, data);
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
        if (includeSender) {
          io.emit(eventName, data);
        } else {
          io.emit(eventName, data);
        }
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
