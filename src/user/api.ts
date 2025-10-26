import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisStorage, getSocketClientByUuid } from '../storage/redis';
import { getUserQuerySchema, deleteUserBodySchema, getUserByTokenParamsSchema, getSocketClientQuerySchema } from '../validation/zod-schemas';
import { ZodError } from 'zod';
import { userSchemas } from './schemas';
import { authGuard } from '../middleware/auth-guard';

export default async function userApi(fastify: FastifyInstance) {


  fastify.get('/user/token/:token', {
    schema: userSchemas.getUserByToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = getUserByTokenParamsSchema.parse(request.params);
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
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user data',
        details: error.message
      });
    }
  });

  fastify.get('/user', {
    preHandler: [authGuard],
    schema: userSchemas.getUser
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queryParams = getUserQuerySchema.parse(request.query);
      const { token, userUuid } = queryParams;

      let user = null;
      const io = fastify.io;

      if (token) {
        user = await redisStorage.getUserByJWT(token);
      }
      else if (userUuid) {
        const users = await redisStorage.getUsersByIdentifiers({ userUuid });
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
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user data',
        details: error.message
      });
    }
  });

  fastify.delete('/user', {
    preHandler: [authGuard],
    schema: userSchemas.deleteUser
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = deleteUserBodySchema.parse(request.body);
      const { token, userUuid } = body;

      let user = null;
      const io = fastify.io;
      let removed = false;

      if (userUuid) {
        removed = await redisStorage.removeUserByUuid(userUuid);
        if (removed) {
          const result = await getSocketClientByUuid(userUuid, io);
          user = result?.userData;
        }
      }
      else if (token) {
        user = await redisStorage.getUserByJWT(token);
        if (user) {
          const socket = io.sockets.sockets.get(user.socketId);
          if (socket) {
            socket.disconnect(true);
          }
          await redisStorage.removeUser(token);
          removed = true;
        }
      }

      if (!removed) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      return {
        success: true,
        message: 'User disconnected and removed from storage',
        user: user ? {
          socketId: user.socketId,
          identifiers: user.identifiers
        } : { userUuid }
      };
    } catch (error: any) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to disconnect user',
        details: error.message
      });
    }
  });

  fastify.get('/socket-client', {
    preHandler: [authGuard],
    schema: userSchemas.getSocketClient
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userUuid } = getSocketClientQuerySchema.parse(request.query);
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
        userData: {...userData, rooms: undefined},
        rooms: rooms
      };
    } catch (error: any) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to get socket client',
        details: error.message
      });
    }
  });
}