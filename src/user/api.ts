import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisStorage } from '../storage/redis';

async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token not provided' });
  }
  return;
}

export default async function userApi(fastify: FastifyInstance) {
  fastify.get(
    '/clients',
    {
      preHandler: [authGuard],
      schema: {
        description: 'Get all connected socket clients with their identifiers',
        summary: 'Get Connected Clients',
        tags: ['User Management'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              clientsList: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    socketId: { type: 'string' },
                    identifiers: {
                      type: 'object',
                      properties: {
                        userId: { type: 'string', nullable: true },
                        userSource: { type: 'string', nullable: true },
                      }
                    },
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
        const clientsList = [];

        const storedUsers = await redisStorage.getUsersWithDetails();

        for (const storedUser of storedUsers) {
          const socket = io.sockets.sockets.get(storedUser.socketId);
          const rooms = socket ? Array.from(socket.rooms).filter(room => room !== storedUser.socketId) : storedUser.rooms;

          clientsList.push({
            socketId: storedUser.socketId,
            identifiers: storedUser.identifiers,
            connectedAt: storedUser.connectedAt,
            lastSeen: storedUser.lastSeen,
            rooms,
            isConnected: !!socket
          });
        }

        console.log('clients', clientsList);

        return {
          success: true,
          clientsList,
          totalClients: clientsList.length
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

  fastify.get('/user/token/:token', {
    schema: {
      summary: 'Get user data by JWT token (path parameter)',
      tags: ['User Management'],
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
                identifiers: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', nullable: true },
                    userSource: { type: 'string', nullable: true },
                  }
                },
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
      const user = await redisStorage.getUserByJWT(token);

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
        error: 'Failed to get user data',
        details: error.message
      });
    }
  });

  fastify.get('/user', {
    preHandler: [authGuard],
    schema: {
      description: 'Get user data by query parameters (token, userId, or userSource)',
      summary: 'Get User Data',
      tags: ['User Management'],
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT token to find user' },
          userId: { type: 'string', description: 'User ID to find user' },
          userSource: { type: 'string', description: 'User source to find user' }
        },
        anyOf: [
          { required: ['token'] },
          { required: ['userId'] },
          { required: ['userSource'] }
        ]
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
                identifiers: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', nullable: true },
                    userSource: { type: 'string', nullable: true },
                  }
                },
                connectedAt: { type: 'string' },
                lastSeen: { type: 'string' },
                rooms: { type: 'array', items: { type: 'string' } },
                isConnected: { type: 'boolean' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { token?: string; userId?: string; userSource?: string };
      const { token, userId, userSource } = query;

      if (!token && !userId && !userSource) {
        return reply.status(400).send({
          success: false,
          error: 'At least one query parameter (token, userId, or userSource) is required'
        });
      }

      let user = null;
      const io = fastify.io;

      if (token) {
        user = await redisStorage.getUserByJWT(token);
      }
      else if (userId) {
        const users = await redisStorage.getUsersByUserId(userId);
        console.log('users', users);
        user = users.length > 0 ? users[0] : null;
      }
      else if (userSource) {
        const users = await redisStorage.getUsersByIdentifiers({ userSource });
        user = users.length > 0 ? users[0] : null;
      }

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      const socket = io.sockets.sockets.get(user.socketId);
      const isConnected = !!socket;

      const rooms = socket ? Array.from(socket.rooms).filter(room => room !== user.socketId) : user.rooms;

      return {
        success: true,
        user: {
          socketId: user.socketId,
          identifiers: user.identifiers,
          connectedAt: user.connectedAt,
          lastSeen: user.lastSeen,
          rooms,
          isConnected
        }
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user data',
        details: error.message
      });
    }
  });
}
