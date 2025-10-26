import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtManager } from '.';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

import { createJwtSchema, verifyJwtSchema } from '../validation/zod-schemas';
import { fastifyZodPreHandler } from '../validation/zod-utils';
import { redisStorage } from '../storage/redis';
import { storageConfig } from '../storage/config';
import { authGuard } from '../middleware/auth-guard';

function generateUserUuid(): string {
  return uuidv4();
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
            userUuid: { type: ['string', 'number'], description: 'User UUID' }
          },
          required: ['userUuid']
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
      const { userUuid, ...identifiers } = body;

      const identifiersObj: any = {
        userUuid: userUuid,
        ...identifiers
      };

      const payload: any = {
        identifiers: identifiersObj
      };

      const token = jwtManager.sign(payload);

      await redisStorage.addUser(
        token,
        storageConfig.tempSocketId,
        true,
        identifiersObj,
        []
      );

      return { token };
    }
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
    }
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
    }
  );
}