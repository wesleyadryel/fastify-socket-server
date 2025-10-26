
import fastify from 'fastify';

import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

import socketioServer from '../plugins/socket';
import jwtApi from '../jwt/jwt-api';
import subscriberApi from '../subscribers/api';
import userApi from '../user/api';
import { roomApi } from '../room';
import swaggerPlugin from '../plugins/swagger';
import underPressurePlugin from '../plugins/under-pressure';

import localRequestsPlugin from '../plugins/localRequests';
import metricsPluginCustom from '../plugins/metrics';
import rateLimitPlugin from '../plugins/rateLimit';

import { registerSocketHandlers } from '../socket';
import errorHandlerPlugin from '../errors/error-handler';
import { Server } from 'socket.io';
import { 
  reconnectionManager, 
  redisStorage, 
  initializeStorage,
  shutdownStorage 
} from '../storage';


const app = fastify({
  logger: process.env.Debug === 'true',
  trustProxy: true,
  ajv: {
    customOptions: { strictTypes: true, allowUnionTypes: true }
  }
});


app.register(cors, { origin: true });
app.register(helmet, { contentSecurityPolicy: false });
app.register(rateLimitPlugin);

if (process.env.NODE_ENV === 'development' || process.env.Debug === 'true') {
  app.register(swaggerPlugin);
}

app.register(socketioServer);
app.register(jwtApi);
app.register(subscriberApi);
app.register(userApi);
app.register(roomApi);
app.register(underPressurePlugin);
app.register(localRequestsPlugin);
app.register(metricsPluginCustom);
app.register(errorHandlerPlugin);


app.ready(async (err) => {
  if (err) throw err;
  
  await initializeStorage();
  
  if (process.env.NODE_ENV === 'development') {
    const { subscriberService } = require('../subscribers');
    try {
      subscriberService.createSubscriber({
        eventListener: 'TEST-EVENT',
        replicable: true,
        includeSender: true,
        description: 'Default test subscriber'
      });
    } catch (error: any) {

    }
  }
  
  reconnectionManager.setIO(app.io);
  
  app.io.on('connection', (socket: any) => {
    const isRecovered = socket.recovered;
    
    console.info('Socket connected!', {
      socketId: socket.id,
      userUuid: socket.data.userUuid,
      authenticated: socket.data.authenticated,
      rooms: socket.rooms ? Array.from(socket.rooms) : [],
      recovered: isRecovered
    });
    
    if (isRecovered) {
      console.info('Socket reconnected with recovery', { socketId: socket.id });
      socket.emit('reconnected', {
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    }
    
    socket.on('error', (error: Error) => {
      console.error('Socket error:', {
        socketId: socket.id,
        error: error.message,
        userUuid: socket.data.userUuid
      });
    });
    
    registerSocketHandlers(socket);
  });
});


if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: 3000, host: '0.0.0.0' });
}

process.on('SIGINT', async () => {
  await shutdownStorage();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownStorage();
  process.exit(0);
});


declare module 'fastify' {
  interface FastifyInstance {
    io: Server<{ hello: string }>;
  }
}


export default app;