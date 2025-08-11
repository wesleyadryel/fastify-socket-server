import { ZodSchema, ZodError } from 'zod';
import { FastifyReply, FastifyRequest } from 'fastify';

export function validateZodSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function fastifyZodPreHandler<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    try {
      request.body = validateZodSchema(schema, request.body);
      done();
    } catch (err) {
      if (err instanceof ZodError) {
        reply.status(400).send({ error: 'Validation error', details: err.issues });
      } else {
        reply.status(400).send({ error: 'Invalid request' });
      }
    }
  };
}
