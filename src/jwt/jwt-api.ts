import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtManager } from '.';
import dotenv from 'dotenv';
dotenv.config();


import { createJwtSchema, verifyJwtSchema } from '../validation/zod-schemas';
import { fastifyZodPreHandler } from '../validation/zod-utils';

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
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

export default async function jwtApi(fastify: FastifyInstance) {

  fastify.post(
    '/jwt/create',
    {
      preHandler: [authGuard, fastifyZodPreHandler(createJwtSchema)],
      schema: {
        description: 'Create a JWT token for a user',
        summary: 'Create JWT Token',
        tags: ['JWT Authentication'],
        body: {
          type: 'object',
          properties: {
            userId: { type: ['string', 'number'], description: 'User identifier' }
          },
          required: ['userId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'JWT token' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as any;
      const { userId, ...identifiers } = body;
      
      const payload: any = {
        userId
      };
      
      // Only add identifiers if there are additional fields beyond userId
      if (Object.keys(identifiers).length > 0) {
        payload.identifiers = {
          userId,
          ...identifiers
        };
      }
      
      const token = jwtManager.sign(payload);
      return { token };
    },
  );


  fastify.post(
    '/jwt/decode',
    {
      preHandler: [authGuard, fastifyZodPreHandler(verifyJwtSchema)],
      schema: {
        description: 'Decode a JWT token and return its payload',
        summary: 'Decode JWT Token',
        tags: ['JWT Authentication'],
        body: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT token' }
          },
          required: ['token']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              payload: { type: 'object', description: 'Decoded payload' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { token } = request.body as { token: string };
      const payload = jwtManager.decode(token);
      return { payload };
    },
  );


  fastify.post(
    '/jwt/verify',
    {
      preHandler: [authGuard, fastifyZodPreHandler(verifyJwtSchema)],
      schema: {
        description: 'Verify a JWT token and return its validity and payload',
        summary: 'Verify JWT Token',
        tags: ['JWT Authentication'],
        body: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT token' }
          },
          required: ['token']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean', description: 'Token validity' },
              payload: { type: 'object', description: 'Decoded payload', nullable: true },
              error: { type: 'string', description: 'Error message', nullable: true }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { token } = request.body as { token: string };
      try {
        const payload = jwtManager.verify(token);
        return { valid: true, payload };
      } catch (e) {
        return { valid: false, error: (e as Error).message, payload: null };
      }
    },
  );
}
