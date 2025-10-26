import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server, ServerOptions } from 'socket.io';
import { authMiddleware } from '../server/auth';

export type FastifySocketioOptions = Partial<ServerOptions> & {
  preClose?: (done: () => void) => void;
};

const fastifySocketIO: FastifyPluginAsync<FastifySocketioOptions> = fp(
  async (fastify, options: FastifySocketioOptions) => {
    const defaultPreClose = (done: () => void): void => {
      (fastify as { io: Server }).io.local.disconnectSockets(true);
      done();
    };

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'];
    
    const io = new Server(fastify.server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      ...options
    });
    io.use(authMiddleware);
    fastify.decorate('io', io);

    fastify.addHook('preClose', (done) => {
      if (options.preClose) {
        options.preClose(done);
        return;
      }
      defaultPreClose(done);
    });

    fastify.addHook('onClose', (instance: FastifyInstance, done) => {
      (instance as { io: Server }).io.close();
      done();
    });
  },
  { fastify: '>=4.0.0', name: 'fastify-socket.io' }
);

export default fastifySocketIO;