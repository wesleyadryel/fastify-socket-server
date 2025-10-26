import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { roomStorage } from './storage';
import { Room, CreateRoomData, UpdateRoomData } from './types';
import { roomSchemas } from './schemas';

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

export default async function roomApi(fastify: FastifyInstance) {
  fastify.post('/rooms', {
    preHandler: [authGuard],
    schema: roomSchemas.createRoom
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roomData = request.body as CreateRoomData & { userId?: string; id?: string };
      const userId = roomData.userId || 'system';
      
      const roomId = roomData.id || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const existingRoom = await roomStorage.getRoom(roomId);
      
      if (existingRoom) {
        const updateData: UpdateRoomData = {
          name: roomData.name,
          description: roomData.description,
          allowSelfJoin: roomData.allowSelfJoin,
          maxMembers: roomData.maxMembers,
          isPrivate: roomData.isPrivate
        };
        
        await roomStorage.updateRoom(roomId, updateData);
        
        const updatedRoom = await roomStorage.getRoom(roomId);
        
        reply.code(200).send({
          success: true,
          data: updatedRoom,
          message: 'Room updated successfully'
        });
        return;
      }
      
      const room: Room = {
        id: roomId,
        name: roomData.name,
        description: roomData.description,
        allowSelfJoin: roomData.allowSelfJoin,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [userId],
        maxMembers: roomData.maxMembers,
        isPrivate: roomData.isPrivate
      };

      await roomStorage.createRoom(room);
      await roomStorage.addMemberToRoom(roomId, userId);

      reply.code(201).send({
        success: true,
        data: room
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/rooms', {
    preHandler: [authGuard],
    schema: roomSchemas.getAllRooms
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rooms = await roomStorage.getAllRooms();
      reply.send({
        success: true,
        data: rooms
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/rooms/:roomId', {
    preHandler: [authGuard],
    schema: roomSchemas.getRoom
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const room = await roomStorage.getRoom(roomId);
      
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      reply.send({
        success: true,
        data: room
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/rooms/:roomId', {
    preHandler: [authGuard],
    schema: roomSchemas.updateRoom
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const updateData = request.body as UpdateRoomData;
      const userId = 'system';
      
      const room = await roomStorage.getRoom(roomId);
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      if (room.createdBy !== userId) {
        reply.code(403).send({ error: 'Only room creator can update room' });
        return;
      }

      const success = await roomStorage.updateRoom(roomId, updateData);
      if (!success) {
        reply.code(500).send({ error: 'Failed to update room' });
        return;
      }

      const updatedRoom = await roomStorage.getRoom(roomId);
      
      reply.send({
        success: true,
        data: updatedRoom
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/rooms/:roomId', {
    preHandler: [authGuard],
    schema: roomSchemas.deleteRoom
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = 'system';
      
      const room = await roomStorage.getRoom(roomId);
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      if (room.createdBy !== userId) {
        reply.code(403).send({ error: 'Only room creator can delete room' });
        return;
      }

      const success = await roomStorage.deleteRoom(roomId);
      if (!success) {
        reply.code(500).send({ error: 'Failed to delete room' });
        return;
      }

      reply.send({
        success: true,
        message: 'Room deleted successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/rooms/:roomId/members', {
    preHandler: [authGuard],
    schema: roomSchemas.getRoomMembers
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = 'system';
      
      const room = await roomStorage.getRoom(roomId);
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      const isMember = await roomStorage.isUserInRoom(roomId, userId);
      if (!isMember) {
        reply.code(403).send({ error: 'You are not a member of this room' });
        return;
      }

      const members = await roomStorage.getRoomMembers(roomId);
      
      reply.send({
        success: true,
        data: members
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/rooms/:roomId/members', {
    preHandler: [authGuard],
    schema: roomSchemas.addRoomMember
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const { userId: targetUserId } = request.body as { userId: string };
      const currentUserId = 'system';
      
      const room = await roomStorage.getRoom(roomId);
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      if (room.createdBy !== currentUserId) {
        reply.code(403).send({ error: 'Only room creator can add members' });
        return;
      }

      const success = await roomStorage.addMemberToRoom(roomId, targetUserId);
      if (!success) {
        reply.code(400).send({ error: 'Failed to add member to room' });
        return;
      }

      reply.send({
        success: true,
        message: 'Member added to room successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/rooms/:roomId/members/:userId', {
    preHandler: [authGuard],
    schema: roomSchemas.removeRoomMember
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId, userId: targetUserId } = request.params as { roomId: string; userId: string };
      const currentUserId = 'system';
      
      const room = await roomStorage.getRoom(roomId);
      if (!room) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }

      if (room.createdBy !== currentUserId && targetUserId !== currentUserId) {
        reply.code(403).send({ error: 'You can only remove yourself or be removed by room creator' });
        return;
      }

      const success = await roomStorage.removeMemberFromRoom(roomId, targetUserId);
      if (!success) {
        reply.code(400).send({ error: 'Failed to remove member from room' });
        return;
      }

      reply.send({
        success: true,
        message: 'Member removed from room successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/rooms/:roomId/can-join', {
    preHandler: [authGuard],
    schema: roomSchemas.checkRoomAccess
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = 'system';
      
      const result = await roomStorage.canUserJoinRoom(roomId, userId);
      
      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
