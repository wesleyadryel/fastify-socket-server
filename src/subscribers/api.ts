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
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  message: { type: 'string' },
                  wasUpdated: { type: 'boolean' }
                }
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    eventListener: { type: 'string' },
                    replicable: { type: 'boolean' },
                    includeSender: { type: 'boolean' },
                    description: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    message: { type: 'string' },
                    wasUpdated: { type: 'boolean' }
                  }
                }
              }
            ]
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as any;
      
      // Check if body is an array
      if (Array.isArray(body)) {
        const results = [];
        const errors = [];
        
        for (const subscriberData of body) {
          try {
            // Validate each subscriber data
            const validatedData = createSubscriberSchema.parse(subscriberData);
            
            const existingSubscriber = subscriberService.findSubscriberByEventListener(validatedData.eventListener);
            const subscriber = subscriberService.createSubscriber(validatedData);
            
            results.push({
              ...subscriber,
              message: existingSubscriber ? 'Subscriber updated (replaced existing subscriber with same eventListener)' : 'Subscriber created successfully',
              wasUpdated: !!existingSubscriber
            });
          } catch (error: any) {
            errors.push({
              eventListener: subscriberData.eventListener || 'unknown',
              error: error.message
            });
          }
        }
        
        if (errors.length > 0) {
          return reply.status(400).send({
            message: 'Some subscribers failed to create/update',
            results,
            errors
          });
        }
        
        return {
          message: `${results.length} subscribers processed successfully`,
          results,
          totalCreated: results.filter(r => !r.wasUpdated).length,
          totalUpdated: results.filter(r => r.wasUpdated).length
        };
      } else {
        // Single subscriber (original behavior)
        const validatedData = createSubscriberSchema.parse(body);
        const { eventListener } = validatedData;
        
        const existingSubscriber = subscriberService.findSubscriberByEventListener(eventListener);
        const subscriber = subscriberService.createSubscriber(validatedData);
        
        if (existingSubscriber) {
          return {
            ...subscriber,
            message: 'Subscriber updated (replaced existing subscriber with same eventListener)',
            wasUpdated: true
          };
        }
        
        return {
          ...subscriber,
          message: 'Subscriber created successfully',
          wasUpdated: false
        };
      }
    }
  );

  fastify.post(
    '/subscribers/with-validation',
    {
      preHandler: [authGuard, fastifyZodPreHandler(createSubscriberWithSchemaSchema)],
      schema: {
        description: 'Create a new event subscriber with parameter validation',
        summary: 'Create Subscriber with Validation',
        tags: ['Event Subscribers'],
        body: {
          type: 'object',
          properties: {
            eventListener: { type: 'string', description: 'Event listener name' },
            replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
            description: { type: 'string', description: 'Optional description' },
            parameters: {
              type: 'array',
              description: 'Parameter validation rules',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'] },
                  required: { type: 'boolean' },
                  sanitize: { type: 'boolean' },
                  maxLength: { type: 'number' },
                  pattern: { type: 'string' },
                  allowedValues: { type: 'array' }
                },
                required: ['name', 'type']
              }
            }
          },
          required: ['eventListener']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              parameters: { type: 'array', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              message: { type: 'string' },
              wasUpdated: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { eventListener } = request.body as any;
      
      const existingSubscriber = subscriberService.findSubscriberByEventListener(eventListener);
      const subscriber = subscriberService.createSubscriber(request.body as any);
      
      if (existingSubscriber) {
        return {
          ...subscriber,
          message: 'Subscriber updated (replaced existing subscriber with same eventListener)',
          wasUpdated: true
        };
      }
      
      return {
        ...subscriber,
        message: 'Subscriber created successfully with parameter validation',
        wasUpdated: false
      };
    }
  );

  fastify.get(
    '/subscribers',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Get all event subscribers',
        summary: 'List All Subscribers',
        tags: ['Event Subscribers'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                eventListener: { type: 'string' },
                replicable: { type: 'boolean' },
                includeSender: { type: 'boolean' },
                description: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const subscribers = subscriberService.getAllSubscribers();
      return subscribers;
    }
  );

  fastify.get(
    '/subscribers/:id',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Get a specific subscriber by ID',
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
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const subscriber = subscriberService.getSubscriber(id);
      
      if (!subscriber) {
        return reply.status(404).send({ error: 'Subscriber not found' });
      }
      
      return subscriber;
    }
  );

  fastify.put(
    '/subscribers/:id',
    {
      preHandler: [authGuard, fastifyZodPreHandler(updateSubscriberSchema)],
      schema: {
        description: 'Update an existing subscriber',
        summary: 'Update Subscriber',
        tags: ['Event Subscribers'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        body: {
          type: 'object',
          properties: {
            eventListener: { type: 'string', description: 'Event listener name' },
            replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
            description: { type: 'string', description: 'Optional description' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updateData = request.body as any;
      
      const subscriber = subscriberService.updateSubscriber(id, updateData);
      
      if (!subscriber) {
        return reply.status(404).send({ error: 'Subscriber not found' });
      }
      
      return subscriber;
    }
  );

  fastify.delete(
    '/subscribers/:id',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Delete a subscriber',
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
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = subscriberService.deleteSubscriber(id);
      
      if (!deleted) {
        return reply.status(404).send({ error: 'Subscriber not found' });
      }
      
      return { success: true, message: 'Subscriber deleted successfully' };
    }
  );

  fastify.get(
    '/subscribers/event/:eventListener',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Get all subscribers for a specific event',
        summary: 'Get Subscribers by Event',
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
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                eventListener: { type: 'string' },
                replicable: { type: 'boolean' },
                includeSender: { type: 'boolean' },
                description: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { eventListener } = request.params as { eventListener: string };
      const subscribers = subscriberService.getSubscribersByEvent(eventListener);
      return subscribers;
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
      const deletedCount = subscriberService.deleteAllSubscribers();
      return { 
        success: true, 
        message: `Successfully deleted ${deletedCount} subscribers`,
        deletedCount 
      };
    }
  );

  // Server emit event route
  fastify.post(
    '/server/emit',
    {
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
              description: 'Target specific user with multiple possible identifiers',
              properties: {
                userId: { type: 'string', description: 'User ID from JWT' },
                userSource: { type: 'string', description: 'User source from JWT' }
              }
            },
            includeSender: { type: 'boolean', description: 'Whether to include the server in the broadcast' }
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
              clientsCount: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { eventName, data, roomId, emitToUser, includeSender = false } = request.body as any;
      
      try {
        const io = fastify.io;
        let clientsCount = 0;
        let targetInfo = '';
        
        if (emitToUser) {
          const targetSockets = [];
          const identifiers = Object.entries(emitToUser).filter(([key, value]) => value !== undefined && value !== null && value !== '');
          
          if (identifiers.length === 0) {
            return reply.status(400).send({
              success: false,
              error: 'Invalid emitToUser',
              message: 'At least one identifier must be provided in emitToUser object'
            });
          }
          
          // Use persistent storage to find users by identifiers
          const storedUsers = await redisStorage.getUsersByIdentifiers(emitToUser);
          
          for (const storedUser of storedUsers) {
            const socket = io.sockets.sockets.get(storedUser.socketId);
            if (socket) {
              targetSockets.push(socket);
            }
          }
          
          if (targetSockets.length === 0) {
            return reply.status(404).send({
              success: false,
              error: 'User not found',
              message: `No user found with identifiers: ${JSON.stringify(emitToUser)}`
            });
          }
          
          targetSockets.forEach(socket => {
            socket.emit(eventName, {
              ...data,
              serverEmitted: true,
              timestamp: new Date().toISOString(),
              targetUser: emitToUser
            });
          });
          
          clientsCount = targetSockets.length;
          targetInfo = `user with identifiers: ${JSON.stringify(emitToUser)}`;
          
        } else if (roomId) {
          io.to(roomId).emit(eventName, {
            ...data,
            serverEmitted: true,
            timestamp: new Date().toISOString(),
            roomId
          });
          
          const room = io.sockets.adapter.rooms.get(roomId);
          clientsCount = room ? room.size : 0;
          targetInfo = `room: ${roomId}`;
          
        } else {
          io.emit(eventName, {
            ...data,
            serverEmitted: true,
            timestamp: new Date().toISOString()
          });
          
          clientsCount = io.sockets.sockets.size;
          targetInfo = 'all clients';
        }
        
        return {
          success: true,
          message: `Event emitted to ${targetInfo}`,
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
    }
  );

  // Get connected clients
  fastify.get(
    '/clients',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Get all connected socket clients with their identifiers',
        summary: 'Get Connected Clients',
        tags: ['Server Events'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              clients: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    socketId: { type: 'string' },
                    userId: { type: 'string', nullable: true },
                    authenticated: { type: 'boolean' },
                    user: { type: 'object', nullable: true },
                    connectedAt: { type: 'string' },
                    rooms: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              totalClients: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const io = fastify.io;
        const clients = [];
        
        // Get all users from persistent storage
        const storedUsers = await redisStorage.getAllUsers();
        
        for (const storedUser of storedUsers) {
          // Check if socket is still connected
          const socket = io.sockets.sockets.get(storedUser.socketId);
          const rooms = socket ? Array.from(socket.rooms).filter(room => room !== storedUser.socketId) : storedUser.rooms;
          
          clients.push({
            socketId: storedUser.socketId,
            userId: storedUser.userId,
            authenticated: storedUser.authenticated,
            user: storedUser.user,
            connectedAt: storedUser.connectedAt,
            lastSeen: storedUser.lastSeen,
            rooms,
            isConnected: !!socket
          });
        }
        
        return {
          success: true,
          clients,
          totalClients: clients.length
        };
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get connected clients',
          details: error.message
        });
      }
    }
  );

  // Get user by JWT token route
  fastify.get('/user/jwt/:token', {
    schema: {
      summary: 'Get user by JWT token',
      tags: ['Users'],
      params: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        },
        required: ['token']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                socketId: { type: 'string' },
                userId: { type: 'string' },
                authenticated: { type: 'boolean' },
                user: { type: 'object' },
                connectedAt: { type: 'string' },
                lastSeen: { type: 'string' },
                rooms: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const user = await redisStorage.getUserByJWTToken(token);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }
      
      return {
        success: true,
        user
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user',
        details: error.message
      });
    }
  });


}
