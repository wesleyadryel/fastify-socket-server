import { FastifyPluginAsync, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import underPressure from '@fastify/under-pressure'

const underPressurePlugin: FastifyPluginAsync<FastifyPluginOptions> = fp(
  async function (fastify, opts) {

        fastify.register(underPressure, {
            maxEventLoopDelay: 5000,
            maxHeapUsedBytes: 1_000_000_000,
            maxRssBytes: 2_000_000_000,
            maxEventLoopUtilization: 0.99,
            healthCheck: async (fastifyInstance) => {
                return true
            },
            exposeStatusRoute: {
                url: '/alive',
                routeOpts: {
                    logLevel: 'debug',
                    config: {
                        someAttr: 'value'
                    }
                },
                routeSchemaOpts: {
                    hide: true
                }
            }
        });
    fastify.log.info('Route /alive registered for health check');

    },
    { fastify: '>=4.0.0', name: 'fastify-socket.io' },
)

export default underPressurePlugin