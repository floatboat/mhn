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
