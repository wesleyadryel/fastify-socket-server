import rateLimit from '@fastify/rate-limit';
import { FastifyPluginAsync, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import Log from '../utils/log';


const rateLimitPlugin: FastifyPluginAsync<FastifyPluginOptions> = fp(
  async function (fastify, opts) {
    await fastify.register(rateLimit, {
      global: false,
      max: 100,
      ban: 10,
      timeWindow: '1 minute',
      hook: 'preHandler',
      cache: 1000,
      allowList: [],
      continueExceeding: false,
      skipOnError: true,
      enableDraftSpec: true,
      addHeadersOnExceeding: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      },
      onExceeding: (req) => {
        Log.log(
          `[RateLimit][${new Date().toISOString()}] Exceeding limit for IP: ${req.ip} | Route: ${req.url} | Method: ${req.method}`
        );
      },
      onExceeded: (req) => {
        Log.warning(
          `[RateLimit][${new Date().toISOString()}] BLOCKED IP: ${req.ip} | Route: ${req.url} | Method: ${req.method}`
        );
      },
    });

    fastify.addHook('onSend', (req, reply, payload, done) => {
      if (reply.getHeader('x-ratelimit-limit')) {
        Log.log(
          `[RateLimit][${new Date().toISOString()}] IP: ${req.ip} | Route: ${req.url} | Method: ${req.method} | Remaining: ${reply.getHeader(
            'x-ratelimit-remaining'
          )} | Reset: ${reply.getHeader('x-ratelimit-reset')}`
        );
      }
      done();
    });

    fastify.addHook('onRequest', (req, reply, done) => {
      Log.log(
        `[Request][${new Date().toISOString()}] IP: ${req.ip} | Route: ${req.url} | Method: ${req.method}`
      );
      done();
    });

  },
  { fastify: '>=4.0.0', name: 'fastify-rate-limit' }
);

export default rateLimitPlugin;
