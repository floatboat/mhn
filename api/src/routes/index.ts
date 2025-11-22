// src/routes/index.ts
import { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { helloHandler } from '../handlers/handlers';
import userRoutes from './api/user.route';
import authRoutes from './api/auth.route';
import roleRoutes from './api/role.route';
import apikeyRoutes from './api/apikey.route';
import sensorRoutes from './api/sensor.route';
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
  });
}
