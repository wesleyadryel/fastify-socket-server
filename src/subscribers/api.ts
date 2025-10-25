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
      preHandler: [authGuard, fastifyZodPreHandler(createSubscriberSchema)],
      schema: {
        description: 'Create a new event subscriber.',
        tags: ['Subscribers'],
        body: {
          type: 'object',
          properties: {
            eventListener: { type: 'string', description: 'Event listener name' },
            replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients', default: true },
            description: { type: 'string', description: 'Optional description' }
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
              description: { type: 'string', nullable: true },
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
        message: 'Subscriber created successfully',
        wasUpdated: false
      };
    }
  );

  fastify.post(
    '/subscribers/with-validation',
    {
      preHandler: [authGuard, fastifyZodPreHandler(createSubscriberWithSchemaSchema)],
      schema: {
        description: 'Create a new event subscriber with parameter validation.',
        tags: ['Subscribers'],
        body: {
          type: 'object',
          properties: {
            eventListener: { type: 'string', description: 'Event listener name' },
            replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients', default: true },
            description: { type: 'string', description: 'Optional description' },
            parameters: {
              type: 'array',
              description: 'Parameter validation rules',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'] },
                  required: { type: 'boolean', default: false },
                  sanitize: { type: 'boolean', default: true },
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
        description: 'Get all event subscribers.',
        tags: ['Subscribers'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                eventListener: { type: 'string' },
                replicable: { type: 'boolean' },
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
        description: 'Get a specific subscriber by ID.',
        tags: ['Subscribers'],
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
        description: 'Update an existing subscriber.',
        tags: ['Subscribers'],
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
        description: 'Delete a subscriber.',
        tags: ['Subscribers'],
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
        description: 'Get all subscribers for a specific event.',
        tags: ['Subscribers'],
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
        description: 'Delete all subscribers.',
        tags: ['Subscribers'],
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
}
