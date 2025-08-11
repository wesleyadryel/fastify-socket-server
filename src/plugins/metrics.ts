import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import metricsPlugin from 'fastify-metrics';
import { Counter, Gauge } from 'prom-client';
import { ServerOptions } from 'socket.io';
import fp from 'fastify-plugin';

export type FastfyPlugin = Partial<ServerOptions> & {}
const prometheusPrefix = process.env.PROMETHEUS_PREFIX || 'node_fastfy';


const metricsPluginCustom: FastifyPluginAsync<FastfyPlugin> = fp(
    async function (fastify: FastifyInstance) {
        const customCounter = new Counter({
            name: `${prometheusPrefix}_custom_requests_total`,
            help: 'Custom requests counter',
            labelNames: ['app', 'env', 'route', 'method', 'status_code']
        });

        const customGauge = new Gauge({
            name: `${prometheusPrefix}_custom_active_connections`,
            help: 'Number of custom active connections',
            labelNames: ['app', 'env']
        });

   
        fastify.addHook('onRequest', (_req, _reply, done) => {
            customGauge.inc({ app: `${prometheusPrefix}-gateway`, env: process.env.NODE_ENV || 'dev' });
            done();
        });
        fastify.addHook('onResponse', (_req, _reply, done) => {
            customGauge.dec({ app: `${prometheusPrefix}-gateway`, env: process.env.NODE_ENV || 'dev' });
            done();
        });

        fastify.addHook('onResponse', (req, reply, done) => {
            customCounter.inc({
                app: `${prometheusPrefix}-gateway`,
                env: process.env.NODE_ENV || 'dev',
                route: req.url,
                method: req.method,
                status_code: reply.statusCode
            });
            done();
        });

        await fastify.register(metricsPlugin, {
            endpoint: '/metrics',
            defaultMetrics: {
                enabled: true,
                prefix: `${prometheusPrefix}_`,
                labels: { app: `${prometheusPrefix}-gateway`, env: process.env.NODE_ENV || 'dev' },
            },
            routeMetrics: {
                enabled: true,
                overrides: {
                    histogram: {
                        name: `${prometheusPrefix}_http_request_duration_seconds`,
                        help: 'HTTP request duration in seconds',
                        labelNames: ['app', 'env', 'status_code', 'method', 'route'],
                        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
                    },
                    summary: {
                        name: `${prometheusPrefix}_http_request_duration_summary`,
                        help: 'Summary of HTTP request duration',
                        labelNames: ['app', 'env', 'status_code', 'method', 'route'],
                        percentiles: [0.5, 0.75, 0.9, 0.95, 0.99],
                    },
                },
            },
        });
    },
    { fastify: '>=4.0.0', name: `${prometheusPrefix}-metrics-custom` },
);

export default metricsPluginCustom;
