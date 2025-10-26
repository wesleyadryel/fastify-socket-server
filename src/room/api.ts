import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { roomStorage } from './storage';
import { Room, CreateRoomData, UpdateRoomData } from './types';
import { 
  createRoomSchema, 
  updateRoomSchema, 
  roomIdSchema, 
  addMemberSchema, 
  removeMemberSchema,
  getRoomMembersSchema 
} from './validation';
import { jwtManager } from '../jwt';
import { fastifyZodPreHandler } from '../validation/zod-utils';

async function jwtAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Token not provided' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwtManager.verify(token);
    
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      reply.code(401).send({ error: 'Invalid token payload' });
      return;
    }

    // Add user to request object
    (request as any).user = {
      userId: payload.userId,
      ...payload.identifiers
    };
  } catch (error) {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }
}

export default async function roomApi(fastify: FastifyInstance) {
  fastify.post('/rooms', {
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Create a new room',
      summary: 'Create Room',
      tags: ['Room Management'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Room name' },
          description: { type: 'string', description: 'Room description' },
          allowSelfJoin: { type: 'boolean', description: 'Allow users to join without approval' },
          maxMembers: { type: 'number', description: 'Maximum number of members' },
          isPrivate: { type: 'boolean', description: 'Is room private' }
        },
        required: ['name']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                allowSelfJoin: { type: 'boolean' },
                createdBy: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                maxMembers: { type: 'number' },
                isPrivate: { type: 'boolean' },
                members: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roomData = request.body as CreateRoomData;
      const userId = (request as any).user.userId;
      
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  allowSelfJoin: { type: 'boolean' },
                  createdBy: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  maxMembers: { type: 'number' },
                  isPrivate: { type: 'boolean' },
                  members: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      }
    }
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Get a specific room by ID',
      summary: 'Get Room',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                allowSelfJoin: { type: 'boolean' },
                createdBy: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                maxMembers: { type: 'number' },
                isPrivate: { type: 'boolean' },
                members: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Update a room',
      summary: 'Update Room',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Room name' },
          description: { type: 'string', description: 'Room description' },
          allowSelfJoin: { type: 'boolean', description: 'Allow users to join without approval' },
          maxMembers: { type: 'number', description: 'Maximum number of members' },
          isPrivate: { type: 'boolean', description: 'Is room private' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                allowSelfJoin: { type: 'boolean' },
                createdBy: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                maxMembers: { type: 'number' },
                isPrivate: { type: 'boolean' },
                members: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const updateData = request.body as UpdateRoomData;
      const userId = (request as any).user.userId;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Delete a room',
      summary: 'Delete Room',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = (request as any).user.userId;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Get room members',
      summary: 'Get Room Members',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  joinedAt: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'member'] }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = (request as any).user.userId;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Add member to room',
      summary: 'Add Room Member',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to add' }
        },
        required: ['userId']
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const { userId: targetUserId } = request.body as { userId: string };
      const currentUserId = (request as any).user.userId;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Remove member from room',
      summary: 'Remove Room Member',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' },
          userId: { type: 'string', description: 'User ID to remove' }
        },
        required: ['roomId', 'userId']
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId, userId: targetUserId } = request.params as { roomId: string; userId: string };
      const currentUserId = (request as any).user.userId;
      
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
    preHandler: [jwtAuthGuard],
    schema: {
      description: 'Check if user can join room',
      summary: 'Check Room Access',
      tags: ['Room Management'],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Room ID' }
        },
        required: ['roomId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                canJoin: { type: 'boolean' },
                reason: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const userId = (request as any).user.userId;
      
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
