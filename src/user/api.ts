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
        
        const storedUsers = await redisStorage.getUsersWithDetails();
        
        for (const storedUser of storedUsers) {
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

  fastify.get('/user/jwt/:token', {
    schema: {
      summary: 'Get user data by JWT token',
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
}
