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
                createdBy: userUuid,
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
            const { userUuid } = request.query as { userUuid: string };
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
            const { userUuid } = request.query as { userUuid: string };
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

    fastify.post('/rooms/:roomId/update', {
        preHandler: [authGuard],
        schema: roomSchemas.updateRoom
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId } = request.params as { roomId: string };
            const updateData = request.body as UpdateRoomData & { userUuid: string };
            const { userUuid } = updateData;

            const room = await roomStorage.getRoom(roomId);
            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
                return;
            }

            if (room.createdBy !== userUuid) {
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

    fastify.post('/rooms/:roomId/delete', {
        preHandler: [authGuard],
        schema: roomSchemas.deleteRoom
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId } = request.params as { roomId: string };
            const { userUuid } = request.body as { userUuid: string };

            const room = await roomStorage.getRoom(roomId);
            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
                return;
            }

            if (room.createdBy !== userUuid) {
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

    fastify.post('/rooms/:roomId/members/get', {
        preHandler: [authGuard],
        schema: roomSchemas.getRoomMembers
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { roomId } = request.params as { roomId: string };
            const { userUuid, forceCreate = false } = request.body as { userUuid: string; forceCreate?: boolean };

            let room = await roomStorage.getRoom(roomId);

            // Se a sala não existe e forceCreate é true, criar a sala
            if (!room && forceCreate) {
                const newRoom: Room = {
                    id: roomId,
                    name: `Room ${roomId}`,
                    description: `Auto-created room ${roomId}`,
                    allowSelfJoin: true,
                    createdBy: userUuid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    members: [userUuid],
                    maxMembers: undefined,
                    isPrivate: false
                };

                await roomStorage.createRoom(newRoom);
                const addResult = await roomStorage.addMemberToRoom(roomId, userUuid);
                if (!addResult.success) {
                    reply.code(500).send({ error: addResult.message || 'Failed to add member to room' });
                    return;
                }
                room = newRoom;
            }

            if (!room) {
                reply.code(404).send({ error: 'Room not found' });
                return;
            }

            const isMember = await roomStorage.isUserInRoom(roomId, userUuid);
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
            const { userUuid: targetUserUuid, forceCreate } = request.body as { userUuid: string; forceCreate?: boolean };

            const room = await roomStorage.getRoom(roomId);
            if (!room) {
                if (forceCreate && targetUserUuid) {
                    const newRoom: Room = {
                        id: roomId,
                        name: `Room ${roomId}`,
                        description: `Auto-created room ${roomId}`,
                        allowSelfJoin: true,
                        createdBy: targetUserUuid,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        members: [targetUserUuid],
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
