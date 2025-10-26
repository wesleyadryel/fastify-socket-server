import { FastifyRequest, FastifyReply } from 'fastify';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token not provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const API_TOKEN = process.env.API_TOKEN;
  
  if (!API_TOKEN) {
    return reply.status(500).send({ error: 'API_TOKEN not configured on server' });
  }
  
  if (token !== API_TOKEN) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}
