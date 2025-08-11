
import { z } from 'zod';

export const roomIdSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
});

export const createJwtSchema = z.object({
  userId: z.union([z.string().min(1, 'userId is required'), z.number()]),
});

export const verifyJwtSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const messageDataSchema = z.object({
  content: z.string().min(1),
  roomId: z.string().optional(),
  type: z.enum(['text', 'system', 'notification']).optional(),
});

