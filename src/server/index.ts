
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
import { subscriberService } from '../subscribers';
import { defaultSubscribers } from '../subscribers/default-subscribers';


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
  
  // Load default subscribers
  try {
    for (const subscriberConfig of defaultSubscribers) {
      try {
        subscriberService.createSubscriber(subscriberConfig);
        console.info(`Loaded default subscriber: ${subscriberConfig.eventListener}`);
      } catch (error: any) {
        console.warn(`Failed to load subscriber ${subscriberConfig.eventListener}:`, error.message);
      }
    }
    console.info(`Loaded ${defaultSubscribers.length} default subscriber(s)`);
  } catch (error: any) {
    console.error('Failed to load default subscribers:', error.message);
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