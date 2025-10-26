
import { z } from 'zod';

export const roomIdSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
});

export const createJwtSchema = z.object({
  userId: z.union([z.string().min(1, 'userId is required'), z.number()]),
  userUuid: z.union([z.string(), z.number()]).optional(),
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
  replicable: z.boolean(),
  includeSender: z.boolean(),
  description: z.string().optional(),
});

export const updateSubscriberSchema = z.object({
  id: z.string().min(1, 'id is required'),
  eventListener: z.string().min(1, 'eventListener is required').optional(),
  replicable: z.boolean().optional(),
  includeSender: z.boolean().optional(),
  description: z.string().optional(),
});

export const deleteSubscriberSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const eventParameterSchema = z.object({
  name: z.string().min(1, 'Parameter name is required'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean(),
  sanitize: z.boolean(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  allowedValues: z.array(z.any()).optional(),
});

export const createSubscriberWithSchemaSchema = z.object({
  eventListener: z.string().min(1, 'eventListener is required'),
  replicable: z.boolean(),
  includeSender: z.boolean(),
  description: z.string().optional(),
  parameters: z.array(eventParameterSchema).optional(),
});

