import { Room, RoomMember } from './types';
import { storageConfig } from '../storage/config';
import { Socket } from 'socket.io';
import { getRedisConnection } from '../storage/redis-connection';

class RoomStorage {
  private useRedis: boolean = true;
  private localCache: Map<string, Room> = new Map();
  private roomMembersCache: Map<string, RoomMember[]> = new Map();

  constructor() {
    this.useRedis = storageConfig.useRedis;
  }

  private get redis() {
    return getRedisConnection();
  }

  private getRoomKey(roomId: string): string {
    return `${storageConfig.roomKeyPrefix}:${roomId}`;
  }

  private getRoomMembersKey(roomId: string): string {
    return `${storageConfig.roomKeyPrefix}:${roomId}:members`;
  }


  async createRoom(room: Room): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const roomKey = this.getRoomKey(room.id);
        await this.redis.hset(roomKey, {
          id: room.id,
          name: room.name,
          description: room.description || '',
          allowSelfJoin: room.allowSelfJoin.toString(),
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          maxMembers: room.maxMembers?.toString() || '',
          isPrivate: room.isPrivate.toString(),
          members: JSON.stringify(room.members)
        });
        await this.redis.expire(roomKey, 86400 * 30);
      } catch (error) {
        console.error('Redis storage error:', error);
        this.localCache.set(room.id, room);
      }
    } else {
      this.localCache.set(room.id, room);
    }
  }

  async getRoom(roomId: string): Promise<Room | null> {
    if (this.useRedis && this.redis) {
      try {

        const roomKey = this.getRoomKey(roomId);
        const roomData = await this.redis.hgetall(roomKey);

        if (!roomData.id) {
          return null;
        }

        return {
          id: roomData.id,
          name: roomData.name,
          description: roomData.description || undefined,
          allowSelfJoin: roomData.allowSelfJoin === 'true',
          createdAt: roomData.createdAt,
          updatedAt: roomData.updatedAt,
          maxMembers: roomData.maxMembers ? parseInt(roomData.maxMembers) : undefined,
          isPrivate: roomData.isPrivate === 'true',
          members: JSON.parse(roomData.members || '[]')
        };
      } catch (error) {
        console.error('Redis get room error:', error);
        return this.localCache.get(roomId) || null;
      }
    } else {
      return this.localCache.get(roomId) || null;
    }
  }

  async updateRoom(roomId: string, updates: Partial<Room>): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    const updatedRoom = { ...room, ...updates, updatedAt: new Date().toISOString() };

    if (this.useRedis && this.redis) {
      try {
        const roomKey = this.getRoomKey(roomId);
        await this.redis.hset(roomKey, {
          name: updatedRoom.name,
          description: updatedRoom.description || '',
          allowSelfJoin: updatedRoom.allowSelfJoin.toString(),
          updatedAt: updatedRoom.updatedAt,
          maxMembers: updatedRoom.maxMembers?.toString() || '',
          isPrivate: updatedRoom.isPrivate.toString(),
          members: JSON.stringify(updatedRoom.members)
        });
        return true;
      } catch (error) {
        console.error('Redis update room error:', error);
        this.localCache.set(roomId, updatedRoom);
        return true;
      }
    } else {
      this.localCache.set(roomId, updatedRoom);
      return true;
    }
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const roomKey = this.getRoomKey(roomId);

        await this.redis.del(roomKey);
        await this.redis.del(this.getRoomMembersKey(roomId));
        return true;
      } catch (error) {
        console.error('Redis delete room error:', error);
        return false;
      }
    } else {
      this.localCache.delete(roomId);
      this.roomMembersCache.delete(roomId);
      return true;
    }
  }

  getAllRoomsFromSocket(io: any): Room[] {
    const rooms: Room[] = [];
    const socketRooms = io.sockets.adapter.rooms;
    
    for (const [roomId, sockets] of socketRooms) {
      const room = this.localCache.get(roomId);
      if (room) {
        const currentMembers = Array.from(sockets).map(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          return socket?.data?.identifiers?.userUuid || '';
        }).filter(Boolean);
        
        rooms.push({
          ...room,
          members: currentMembers.length > 0 ? currentMembers : room.members
        });
      }
    }
    
    return rooms;
  }


  async addMemberToRoom(roomId: string, userUuid: string, socket?: Socket): Promise<{ success: boolean; message?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, message: 'Room not found' };
    }

    if (room.maxMembers && (room.members.length >= room.maxMembers)) {
      return { success: false, message: 'Room is full' };
    }

    if (room.members.includes(userUuid)) {
      if (socket) {
        socket.join(roomId);
      }
      return { success: true, message: 'User is already a member' };
    }

    const updatedMembers = [...room.members, userUuid];
    const success = await this.updateRoom(roomId, { members: updatedMembers });

    if (success) {
      const member: RoomMember = {
        userUuid,
        joinedAt: new Date().toISOString(),
        role: 'member'
      };

      if (this.useRedis && this.redis) {
        try {
          const membersKey = this.getRoomMembersKey(roomId);
          await this.redis.hset(membersKey, userUuid, JSON.stringify(member));
          await this.redis.expire(membersKey, 86400 * 30);
        } catch (error) {
          console.error('Redis add member error:', error);
        }
      } else {
        const members = this.roomMembersCache.get(roomId) || [];
        members.push(member);
        this.roomMembersCache.set(roomId, members);
      }


      if (socket) {
        socket.join(roomId);
      }
    }

    return { success, message: success ? 'Member added successfully' : 'Failed to add member' };
  }

  async removeMemberFromRoom(roomId: string, userUuid: string, forceRemove: boolean = false): Promise<{ success: boolean; reason?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: 'Room not found' };
    }

    if (!room.members.includes(userUuid)) {
      return { success: true };
    }

    if (!forceRemove && !room.allowSelfJoin) {
      return { success: false, reason: 'Room does not allow self-removal' };
    }

    const updatedMembers = room.members.filter(id => id !== userUuid);
    const success = await this.updateRoom(roomId, { members: updatedMembers });

    if (success) {
      if (this.useRedis && this.redis) {
        try {
          const membersKey = this.getRoomMembersKey(roomId);
          await this.redis.hdel(membersKey, userUuid);
        } catch (error) {
          console.error('Redis remove member error:', error);
        }
      } else {
        const members = this.roomMembersCache.get(roomId) || [];
        const updatedMembersList = members.filter(member => member.userUuid !== userUuid);
        this.roomMembersCache.set(roomId, updatedMembersList);
      }
    }

    return { success };
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    if (this.useRedis && this.redis) {
      try {
        const membersKey = this.getRoomMembersKey(roomId);
        const membersData = await this.redis.hgetall(membersKey);

        return Object.values(membersData).map(memberJson => JSON.parse(memberJson));
      } catch (error) {
        console.error('Redis get room members error:', error);
        return this.roomMembersCache.get(roomId) || [];
      }
    } else {
      return this.roomMembersCache.get(roomId) || [];
    }
  }

  async isUserInRoom(roomId: string, userUuid: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    return room ? room.members.includes(userUuid) : false;
  }

  async canUserJoinRoom(roomId: string, userUuid: string): Promise<{ canJoin: boolean; reason?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { canJoin: false, reason: `Room ${roomId} not found` };
    }

    if (room.members.includes(userUuid)) {
      return { canJoin: true };
    }

    if (room.maxMembers && room.members.length >= room.maxMembers) {
      return { canJoin: false, reason: 'Room is full' };
    }

    if (!room.allowSelfJoin) {
      return { canJoin: false, reason: 'Room requires admin approval' };
    }

    return { canJoin: true };
  }
}

export const roomStorage = new RoomStorage();
