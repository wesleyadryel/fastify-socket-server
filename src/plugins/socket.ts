import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server, ServerOptions } from 'socket.io';
import { authMiddleware } from '../server/auth';
import { Log } from '../utils/log';
import { instrument } from '@socket.io/admin-ui';
import { hashSync } from 'bcryptjs';

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
    const adminOrigins = ['https://admin.socket.io'];
    
    const io = new Server(fastify.server, {
      cors: {
        origin: [...allowedOrigins, ...adminOrigins],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      ...options
    });

    io.use(authMiddleware);

    io.engine.on('connection_error', (err) => {
      Log.error('Socket.IO connection error', {
        error: err.message,
        req: err.req?.url,
        code: err.code,
        context: err.context
      });
    });

    io.on('new_namespace', (namespace) => {
      Log.log('New namespace created', { namespace: namespace.name });
    });

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const hasAdminAuth = adminUsername && adminPassword;
    
    if (process.env.NODE_ENV === 'development' || process.env.Debug === 'true') {
      const authConfig = hasAdminAuth ? {
        type: "basic" as const,
        username: adminUsername!,
        password: hashSync(adminPassword!, 10)
      } : false;
      
      instrument(io, {
        auth: authConfig,
        mode: "development",
        serverId: require('os').hostname() + '#' + process.pid
      });
      
      Log.log('Socket.IO Admin UI enabled', {
        mode: 'development',
        auth: hasAdminAuth ? 'enabled' : 'disabled'
      });
    }

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