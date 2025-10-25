
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

export const createSubscriberSchema = z.object({
  eventListener: z.string().min(1, 'eventListener is required'),
  replicable: z.boolean().default(true),
  description: z.string().optional(),
});

export const updateSubscriberSchema = z.object({
  id: z.string().min(1, 'id is required'),
  eventListener: z.string().min(1, 'eventListener is required').optional(),
  replicable: z.boolean().optional(),
  description: z.string().optional(),
});

export const deleteSubscriberSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

