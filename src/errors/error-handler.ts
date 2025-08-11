import { FastifyError, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from './custom-errors';

const errorHandlerPlugin: FastifyPluginAsync = fp(async (fastify) => {
    fastify.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
        fastify.log.error(error);

        if (error instanceof AppError) {
            reply.status(error.statusCode).send({
                error: error.message,
                details: error.details ?? undefined,
            });
            return;
        }

        if ((error as any).statusCode === 429) {
            reply.status(429).send({
                error: 'You hit the rate limit! Slow down please!'
            });
            return;
        }

        if ((error as any).validation) {
            reply.status(400).send({
                error: 'Validation error',
                details: (error as any).validation
            });
            return;
        }

        reply.status((error as any).statusCode || 500).send({
            error: error.message || 'Internal server error',
        });
    });
});

export default errorHandlerPlugin;