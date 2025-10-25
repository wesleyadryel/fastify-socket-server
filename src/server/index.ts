
import fastify from 'fastify';

import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

import socketioServer from '../plugins/socket';
import jwtApi from '../jwt/jwt-api';
import subscriberApi from '../subscribers/api';
import swaggerPlugin from '../plugins/swagger';
import underPressurePlugin from '../plugins/under-pressure';

import localRequestsPlugin from '../plugins/localRequests';
import metricsPluginCustom from '../plugins/metrics';
import rateLimitPlugin from '../plugins/rateLimit';

import { registerSocketHandlers } from '../socket';
import errorHandlerPlugin from '../errors/error-handler';
import { Server } from 'socket.io';


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
app.register(socketioServer);
app.register(jwtApi);
app.register(subscriberApi);
app.register(underPressurePlugin);
app.register(localRequestsPlugin);
app.register(metricsPluginCustom);
app.register(swaggerPlugin);
app.register(errorHandlerPlugin);


app.ready((err) => {
  if (err) throw err;
  
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
  
  app.io.on('connection', (socket: any) => {
    console.info('Socket connected!', socket.id);
    registerSocketHandlers(socket);
  });
});


if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: 3000, host: '0.0.0.0' });
}


declare module 'fastify' {
  interface FastifyInstance {
    io: Server<{ hello: string }>;
  }
}


export default app;