import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { roomStorage } from './storage';
import { Room, CreateRoomData, UpdateRoomData } from './types';
import { roomSchemas } from './schemas';
import { getSocketClientByUuid } from '../storage/redis';

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
            const roomData = request.body as CreateRoomData & { userUuid?: string; id?: string };
            const userUuid = roomData.userUuid || 'system';

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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: [userUuid],
                maxMembers: roomData.maxMembers,
                isPrivate: roomData.isPrivate
            };

            await roomStorage.createRoom(room);
            const addResult = await roomStorage.addMemberToRoom(roomId, userUuid);
            if (!addResult.success) {
                reply.code(500).send({ error: addResult.message || 'Failed to add member to room' });
                return;
            }

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

    fastify.delete('/rooms/:roomId/delete', {
        preHandler: [authGuard],
        schema: roomSchemas.deleteRoom
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId } = request.params as { roomId: string };

            const room = await roomStorage.getRoom(roomId);
            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
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
            const { forceCreate = false } = request.query as { forceCreate?: boolean };

            let room = await roomStorage.getRoom(roomId);

            if (!room && forceCreate) {
                const newRoom: Room = {
                    id: roomId,
                    name: `Room ${roomId}`,
                    description: `Auto-created room ${roomId}`,
                    allowSelfJoin: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    members: [],
                    maxMembers: undefined,
                    isPrivate: false
                };

                await roomStorage.createRoom(newRoom);
                room = newRoom;
            }

            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
                return;
            }

            const members = await roomStorage.getRoomMembers(roomId);

            reply.send({
                success: true,
                data: {
                    members: members,
                }
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
            const { forceCreate } = request.body as { forceCreate?: boolean };
            const { userUuid } = request.body as { userUuid: string | number };

            if (!userUuid) {
                reply.code(400).send({ error: 'User UUID is required' });
                return;
            }

            const targetUserUuid = userUuid.toString();
            const room = await roomStorage.getRoom(roomId);

            if (!room) {
                if (forceCreate) {
                    const newRoom: Room = {
                        id: roomId,
                        name: `Room ${roomId}`,
                        description: `Auto-created room ${roomId}`,
                        allowSelfJoin: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        members: [],
                        maxMembers: undefined,
                        isPrivate: false
                    };

                    await roomStorage.createRoom(newRoom);
                } else {
                    reply.code(404).send({ error: 'Room not found' });
                    return;
                }
            }

            const io = fastify.io;
            const result = await getSocketClientByUuid(targetUserUuid, io);
            if (!result) {
                reply.code(404).send({ error: 'User not found' });
                return;
            }

            if (!result?.socket) {
                reply.code(404).send({ error: 'User is not connected' });
                return;
            }


            const addResult = await roomStorage.addMemberToRoom(roomId, targetUserUuid, result.socket);
            if (!addResult.success) {
                reply.code(400).send({ error: addResult.message || 'Failed to add member to room' });
                return;
            }

            reply.send({
                success: true,
                message: addResult.message || 'Member added to room successfully'
            });
        } catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    fastify.post('/rooms/:roomId/members/:userUuid/remove', {
        preHandler: [authGuard],
        schema: roomSchemas.removeRoomMember
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId, userUuid } = request.params as { roomId: string; userUuid: string };

            const room = await roomStorage.getRoom(roomId);
            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
                return;
            }

            const result = await roomStorage.removeMemberFromRoom(roomId, userUuid, true);
            if (!result.success) {
                reply.code(400).send({ error: result.reason || 'Failed to remove member from room' });
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

    fastify.post('/rooms/:roomId/can-join', {
        preHandler: [authGuard],
        schema: roomSchemas.checkRoomAccess
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId } = request.params as { roomId: string };
            const { userUuid } = request.body as { userUuid: string };

            const result = await roomStorage.canUserJoinRoom(roomId, userUuid);

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
