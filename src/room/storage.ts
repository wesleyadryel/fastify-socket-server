import { Room, RoomMember } from './types';
import { storageConfig } from '../storage/config';
import { Socket } from 'socket.io';
import { getRedisConnection } from '../storage/redis-connection';

class RoomStorage {
  private useRedis: boolean = true;

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
        throw error;
      }
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
        return null;
      }
    }
    return null;
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
        return false;
      }
    }
    return false;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      try {
        const roomKey = this.getRoomKey(roomId);
        await this.redis.del(roomKey);
        await this.redis.del(this.getRoomMembersKey(roomId));
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async getAllRoomsFromSocket(io: any): Promise<Room[]> {
    const socketRooms = this.getValidRooms(io.sockets.adapter.rooms, io);

    const rooms = await Promise.all(
      socketRooms.map(([roomId, sockets]) => 
        this.buildRoomData(roomId, sockets, io)
      )
    );
    
    return rooms.filter(room => room !== null) as Room[];
  }

  private getValidRooms(adapterRooms: Map<string, Set<string>>, io: any): Array<[string, Set<string>]> {
    return Array.from(adapterRooms.entries())
      .filter(([roomId]) => this.isValidRoom(roomId, io));
  }

  private isValidRoom(roomId: string, io: any): boolean {
    return roomId !== io.sockets.id && !roomId.startsWith('/');
  }

  private async buildRoomData(roomId: string, sockets: Set<string>, io: any): Promise<Room | null> {
    const currentMembers = this.extractMembers(sockets, io);
    
    if (!this.useRedis || !this.redis) {
      return this.createTempRoom(roomId, currentMembers);
    }
    
    try {
      const room = await this.getRoom(roomId);
      if (room) {
        return {
          ...room,
          members: currentMembers.length > 0 ? currentMembers : room.members
        };
      }
      return this.createTempRoom(roomId, currentMembers);
    } catch (error) {
      return null;
    }
  }

  private extractMembers(sockets: Set<string>, io: any): string[] {
    return Array.from(sockets)
      .map(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        return socket?.data?.userUuid || socket?.data?.identifiers?.userUuid || '';
      })
      .filter(Boolean);
  }

  private createTempRoom(roomId: string, members: string[]): Room {
    return {
      id: roomId,
      name: roomId,
      description: '',
      allowSelfJoin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members,
      isPrivate: false
    };
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
        }
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
        }
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
        return [];
      }
    }
    return [];
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
