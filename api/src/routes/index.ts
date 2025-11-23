// src/routes/index.ts
import { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { helloHandler } from '../handlers/handlers';
import userRoutes from './api/user.route';
import authRoutes from './api/auth.route';
import roleRoutes from './api/role.route';
import apikeyRoutes from './api/apikey.route';
import sensorRoutes from './api/sensor.route';
import attackRoutes from './api/attack.route';
import ruleRoutes from './api/rule.route';
import ruleFetchRoutes from './api/rule-fetch.route';
import analyticsRoutes from './api/analytics.route';
import dashboardRoutes from './api/dashboard.route';
import exportRoutes from './api/export.route';
import integrationRoutes from './api/integration.route';
import errorHandler from '../plugins/errorHandler';

export default async function routes(fastify: FastifyInstance) {
  fastify.register(sensible);

  // Root routes
  fastify.route({
    method: 'GET',
    url: '/',
    handler: async function () {
      fastify.log.info('GET / route hit');
      return { root: true };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/error',
    handler: async function () {
      throw new Error('Test error');
    },
  });

  fastify.route({
    method: 'GET',
    url: '/hello',
    handler: helloHandler,
  });

  // Health check endpoints
  fastify.route({
    method: 'GET',
    url: '/health',
    schema: {
      description: 'Basic health check - returns 200 if API is running',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      return { status: 'ok', timestamp: new Date().toISOString() };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/liveness',
    schema: {
      description: 'Kubernetes liveness probe - returns 200 if API is running',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      return { status: 'alive' };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/readiness',
    schema: {
      description: 'Kubernetes readiness probe - checks if dependencies are available',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'boolean' },
                mongodb: { type: 'boolean' },
                redis: { type: 'boolean' },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: { type: 'object' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async function (request, reply) {
      const checks: Record<string, boolean> = {};

      try {
        // Check PostgreSQL
        const prisma = (fastify as any).prisma;
        if (prisma) {
          await prisma.$queryRaw`SELECT 1`;
          checks.database = true;
        }
      } catch (err) {
        checks.database = false;
        fastify.log.warn('Database health check failed');
      }

      try {
        // Check MongoDB
        const mongoClient = (fastify as any).mongoClient;
        if (mongoClient) {
          const admin = mongoClient.db('admin');
          await admin.command({ ping: 1 });
          checks.mongodb = true;
        }
      } catch (err) {
        checks.mongodb = false;
        fastify.log.warn('MongoDB health check failed');
      }

      try {
        // Check Redis
        const redis = (fastify as any).redis;
        if (redis) {
          await redis.ping();
          checks.redis = true;
        }
      } catch (err) {
        checks.redis = false;
        fastify.log.warn('Redis health check failed');
      }

      const allHealthy = Object.values(checks).every((v) => v === true || v === undefined);

      if (!allHealthy) {
        return reply.status(503).send({
          status: 'not_ready',
          checks,
          error: 'Some dependencies are not ready',
        });
      }

      return { status: 'ready', checks };
    },
  });

  // API routes with error handler
  await fastify.register(async (fastify) => {
    await fastify.register(errorHandler);
    await fastify.register(userRoutes);
    await fastify.register(authRoutes);
    await fastify.register(roleRoutes);
    await fastify.register(apikeyRoutes);
    await fastify.register(sensorRoutes);
    await fastify.register(attackRoutes);
    await fastify.register(ruleRoutes);
    await fastify.register(ruleFetchRoutes);
    await fastify.register(analyticsRoutes);
    await fastify.register(dashboardRoutes);
    await fastify.register(exportRoutes);
    await fastify.register(integrationRoutes);
  });
}
