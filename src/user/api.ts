import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisStorage, getSocketClientByUuid } from '../storage/redis';

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
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
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
            additionalProperties: true
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
          additionalProperties: true
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
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        404: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { token?: string; userId?: string; userSource?: string };
      const { token, userId, userSource } = body;

      if (!token && !userId && !userSource) {
        return reply.status(400).send({
          success: false,
          error: 'At least one body parameter (token, userId, or userSource) is required'
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

  fastify.delete('/user', {
    preHandler: [authGuard],
    schema: {
      description: 'Disconnect user and remove from Redis by body parameters (token, userId, or userSource)',
      summary: 'Disconnect User',
      tags: ['User Management'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT token to disconnect user' },
          userId: { type: 'string', description: 'User ID to disconnect user' },
          userSource: { type: 'string', description: 'User source to disconnect user' }
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
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        404: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { token?: string; userId?: string; userSource?: string };
      const { token, userId, userSource } = body;

      if (!token && !userId && !userSource) {
        return reply.status(400).send({
          success: false,
          error: 'At least one body parameter (token, userId, or userSource) is required'
        });
      }

      let user = null;
      const io = fastify.io;

      if (token) {
        user = await redisStorage.getUserByJWT(token);
      }
      else if (userId) {
        const users = await redisStorage.getUsersByUserId(userId);
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
      if (socket) {
        socket.disconnect(true);
      }

      if (token) {
        await redisStorage.removeUser(token);
      } else {
        const removed = await redisStorage.removeUserByIdentifiers(user.identifiers, token);
        if (!removed) {
          return reply.status(404).send({
            success: false,
            error: 'User not found in storage'
          });
        }
      }

      return {
        success: true,
        message: 'User disconnected and removed from storage',
        user: {
          socketId: user.socketId,
          identifiers: user.identifiers
        }
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to disconnect user',
        details: error.message
      });
    }
  });

  fastify.get('/socket-client', {
    preHandler: [authGuard],
    schema: {
      description: 'Get socket client object by user UUID using direct Redis lookup',
      summary: 'Get Socket Client by UUID',
      tags: ['User Management'],
      querystring: {
        type: 'object',
        properties: {
          userUuid: {
            type: 'string',
            description: 'User UUID'
          }
        },
        required: ['userUuid']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            socketId: { type: ['string', 'null'] },
            isConnected: { type: 'boolean' },
            rooms: { type: 'array', items: { type: 'string' } },
            userData: { type: 'object', additionalProperties: true }
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
      const { userUuid } = request.query as { userUuid: string };
      const io = fastify.io;

      const result = await getSocketClientByUuid(userUuid, io);
      
      if (!result) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      const { socket, userData, isConnected } = result;
      const rooms = socket ? Array.from(socket.rooms).filter(room => room !== socket.id) : (userData?.rooms || []);
      const existSocket = !!socket;

      return {
        success: true,
        isConnected: isConnected,
        socketId: existSocket ? (socket?.id || userData?.socketId || null) : undefined,
        userData: userData,
        rooms: rooms
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get socket client',
        details: error.message
      });
    }
  });
}
