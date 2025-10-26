import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import FastifySwagger from '@fastify/swagger';

const swaggerPlugin: FastifyPluginAsync = fp(async (fastify) => {
  await fastify.register(FastifySwagger, {
    openapi: {
      info: { title: 'My Fastify App', version: '1.0.0' },
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', name: 'apiKey', in: 'header' },
        },
      },
    },
  });

  fastify.get('/openapi.json', () => fastify.swagger());
}, { fastify: '>=4.0.0', name: 'fastify-socket.io' });

export default swaggerPlugin;
