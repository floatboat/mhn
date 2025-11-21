// src/routes/api/auth.route.ts
import { FastifyInstance } from 'fastify';
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  getMeHandler,
  resetRequestHandler,
  resetConfirmHandler,
} from '../../handlers/auth.handler';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  resetRequestSchema,
  resetConfirmSchema,
  userInfoSchema,
} from '../../types/auth.types';
import { requireAuth } from '../../decorators/auth.decorators';

/**
 * Authentication routes
 * All routes are prefixed with /api/auth
 */
export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * Login endpoint
   * POST /api/auth/login
   * Public endpoint
   */
  fastify.route({
    method: 'POST',
    url: '/auth/login',
    schema: loginSchema,
    handler: loginHandler,
  });

  /**
   * Logout endpoint
   * POST /api/auth/logout
   * Public endpoint (but requires refresh token)
   */
  fastify.route({
    method: 'POST',
    url: '/auth/logout',
    schema: logoutSchema,
    handler: logoutHandler,
  });

  /**
   * Refresh token endpoint
   * POST /api/auth/refresh
   * Public endpoint (but requires refresh token)
   */
  fastify.route({
    method: 'POST',
    url: '/auth/refresh',
    schema: refreshSchema,
    handler: refreshHandler,
  });

  /**
   * Get current user info
   * GET /api/auth/me
   * Requires authentication
   */
  fastify.route({
    method: 'GET',
    url: '/auth/me',
    schema: userInfoSchema,
    preHandler: requireAuth,
    handler: getMeHandler,
  });

  /**
   * Request password reset
   * POST /api/auth/reset-request
   * Public endpoint
   */
  fastify.route({
    method: 'POST',
    url: '/auth/reset-request',
    schema: resetRequestSchema,
    handler: resetRequestHandler,
  });

  /**
   * Confirm password reset
   * POST /api/auth/reset-confirm
   * Public endpoint
   */
  fastify.route({
    method: 'POST',
    url: '/auth/reset-confirm',
    schema: resetConfirmSchema,
    handler: resetConfirmHandler,
  });
}
