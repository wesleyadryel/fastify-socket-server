import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export function onlyLocalRequest(req: FastifyRequest, reply: FastifyReply, done: () => void) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress);
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        done();
    } else {
        reply.code(403).send({ error: 'Access denied - Firewall' });
    }
}

const localRequestsPlugin: FastifyPluginAsync = fp(
    async function (fastify: FastifyInstance) {

        fastify.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done: () => void) => {
            const url = req.url;
            if (url === '/metrics' || url === '/doc' || url.startsWith('/doc/')) {
                onlyLocalRequest(req, reply, done);
            } else {
                done();
            }
        });

    }
);

export default localRequestsPlugin;