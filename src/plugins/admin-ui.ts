import { Server } from 'socket.io';
import { instrument, RedisStore } from '@socket.io/admin-ui';
import { hashSync } from 'bcryptjs';
import { getRedisConnection } from '../storage/redis-connection';
import { Log } from '../utils/log';
import * as ip from 'ip';

const getClientIP = (socket: any): string => {
  const req = socket.request;
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    ''
  ).replace('::ffff:', '');
};

const createAdminUIMiddleware = (allowedIPs: string[]) => {
  return (socket: any, next: any) => {
    const clientIP = getClientIP(socket);
    if(!clientIP) return next(new Error('This connection was not authorized'));
    
    try {
      const isPrivate = ip.isPrivate(clientIP);      
      const hasAccess = allowedIPs.length === 0 ||
        isPrivate ||
        allowedIPs.includes(clientIP) ||
        allowedIPs.some(allowedIP => clientIP.startsWith(allowedIP));

      if (!hasAccess) {
        Log.log('Admin UI access blocked', { ip: clientIP });
        return next(new Error('This connection was not authorized'));
      }
      
      Log.log('Admin UI access granted', { ip: clientIP });
      next();
    } catch (error) {
      Log.log('Admin UI access blocked - invalid IP', { ip: clientIP });
      return next(new Error('This connection was not authorized'));
    }
  };
};

export const setupAdminUI = (io: Server): void => {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const hasAdminAuth = adminUsername && adminPassword;
  const isProduction = process.env.NODE_ENV === 'production';
  
  const authConfig = hasAdminAuth ? {
    type: "basic" as const,
    username: adminUsername!,
    password: hashSync(adminPassword!, 10)
  } : false;
  
  const redisClient = getRedisConnection();
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
  
  const instrumentConfig: any = {
    auth: authConfig,
    mode: isProduction ? "production" : "development",
    serverId: require('os').hostname() + '#' + process.pid,
    namespaceName: "/admin"
  };
  
  if (redisClient) {
    instrumentConfig.store = new RedisStore(redisClient);
  }
  
  instrument(io, instrumentConfig);
  
  const adminNamespace = io.of("/admin");
  const ipMiddleware = createAdminUIMiddleware(allowedIPs);
  
  adminNamespace.use((socket, next) => {
    ipMiddleware(socket, next);
  });
  
  Log.log('Socket.IO Admin UI enabled', {
    mode: isProduction ? 'production' : 'development',
    auth: hasAdminAuth ? 'enabled' : 'disabled',
    store: redisClient ? 'redis' : 'in-memory'
  });
};

