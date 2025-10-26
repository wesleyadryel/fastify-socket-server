import { Redis } from 'ioredis';
import { Room, RoomMember } from './types';
import { storageConfig } from '../storage/config';

class RoomStorage {
  private redis: Redis | null = null;
  private useRedis: boolean = true;
  private localCache: Map<string, Room> = new Map();
  private roomMembersCache: Map<string, RoomMember[]> = new Map();

  constructor() {
    this.useRedis = storageConfig.useRedis;
    
    if (this.useRedis) {
      this.redis = new Redis({
        host: storageConfig.redis.host,
        port: storageConfig.redis.port,
        password: storageConfig.redis.password,
        db: storageConfig.redis.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('error', (err) => {
        console.error('Redis connection error in RoomStorage:', err);
      });
    }
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
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          maxMembers: room.maxMembers?.toString() || '',
          isPrivate: room.isPrivate.toString(),
          members: JSON.stringify(room.members)
        });
        await this.redis.expire(roomKey, 86400 * 30); // 30 days
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
          createdBy: roomData.createdBy,
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

  async getAllRooms(): Promise<Room[]> {
    if (this.useRedis && this.redis) {
      try {
        const pattern = `${storageConfig.roomKeyPrefix}:*`;
        const rooms: Room[] = [];
        let cursor = '0';
        
        do {
          const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = result[0];
          const keys = result[1];
          
          for (const key of keys) {
            if (!key.includes(':members')) {
              const room = await this.getRoom(key.replace(`${storageConfig.roomKeyPrefix}:`, ''));
              if (room) {
                rooms.push(room);
              }
            }
          }
        } while (cursor !== '0');
        
        return rooms;
      } catch (error) {
        console.error('Redis get all rooms error:', error);
        return Array.from(this.localCache.values());
      }
    } else {
      return Array.from(this.localCache.values());
    }
  }

  async addMemberToRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    if (room.maxMembers && room.members.length >= room.maxMembers) {
      return false;
    }

    if (room.members.includes(userId)) {
      return true; // Already a member
    }

    const updatedMembers = [...room.members, userId];
    const success = await this.updateRoom(roomId, { members: updatedMembers });

    if (success) {
      // Store member details
      const member: RoomMember = {
        userId,
        joinedAt: new Date().toISOString(),
        role: room.createdBy === userId ? 'admin' : 'member'
      };

      if (this.useRedis && this.redis) {
        try {
          const membersKey = this.getRoomMembersKey(roomId);
          await this.redis.hset(membersKey, userId, JSON.stringify(member));
          await this.redis.expire(membersKey, 86400 * 30); // 30 days
        } catch (error) {
          console.error('Redis add member error:', error);
        }
      } else {
        const members = this.roomMembersCache.get(roomId) || [];
        members.push(member);
        this.roomMembersCache.set(roomId, members);
      }
    }

    return success;
  }

  async removeMemberFromRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    if (!room.members.includes(userId)) {
      return true; // Not a member
    }

    const updatedMembers = room.members.filter(id => id !== userId);
    const success = await this.updateRoom(roomId, { members: updatedMembers });

    if (success) {
      if (this.useRedis && this.redis) {
        try {
          const membersKey = this.getRoomMembersKey(roomId);
          await this.redis.hdel(membersKey, userId);
        } catch (error) {
          console.error('Redis remove member error:', error);
        }
      } else {
        const members = this.roomMembersCache.get(roomId) || [];
        const updatedMembersList = members.filter(member => member.userId !== userId);
        this.roomMembersCache.set(roomId, updatedMembersList);
      }
    }

    return success;
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

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    return room ? room.members.includes(userId) : false;
  }

  async canUserJoinRoom(roomId: string, userId: string): Promise<{ canJoin: boolean; reason?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { canJoin: false, reason: `Room ${roomId} not found` };
    }

    if (room.members.includes(userId)) {
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
