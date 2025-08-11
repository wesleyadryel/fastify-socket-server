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

    const io = new Server(fastify.server, options);
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