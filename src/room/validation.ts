import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  allowSelfJoin: z.boolean().default(true),
  maxMembers: z.number().int().min(1).max(1000).optional(),
  isPrivate: z.boolean().default(false),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  allowSelfJoin: z.boolean().optional(),
  maxMembers: z.number().int().min(1).max(1000).optional(),
  isPrivate: z.boolean().optional(),
});

export const roomIdSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
});

export const addMemberSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const removeMemberSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const getRoomMembersSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
});
