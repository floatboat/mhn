// src/routes/api/apikey.route.ts
import { FastifyInstance } from 'fastify';
import {
  listApiKeysHandler,
  createApiKeyHandler,
  deleteApiKeyHandler,
} from '../../handlers/apikey.handler';
import {
  listApiKeysSchema,
  createApiKeySchema,
  deleteApiKeySchema,
} from '../../types/apikey.types';
import { requireAuth, requireRole } from '../../decorators/auth.decorators';

/**
 * API Key management routes
 * All routes are prefixed with /api/apikey
 */
export default async function apikeyRoutes(fastify: FastifyInstance) {
  /**
   * List all API keys
   * GET /api/apikey
   * Requires admin role
   */
  fastify.route({
    method: 'GET',
    url: '/apikey',
    schema: listApiKeysSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: listApiKeysHandler,
  });

  /**
   * Create a new API key for authenticated user
   * POST /api/apikey
   * Requires authentication
   */
  fastify.route({
    method: 'POST',
    url: '/apikey',
    schema: createApiKeySchema,
    preHandler: requireAuth,
    handler: createApiKeyHandler,
  });

  /**
   * Delete an API key
   * DELETE /api/apikey/:id
   * Requires authentication (can only delete own keys unless admin)
   */
  fastify.route({
    method: 'DELETE',
    url: '/apikey/:id',
    schema: deleteApiKeySchema,
    preHandler: requireAuth,
    handler: deleteApiKeyHandler as any, // Type assertion needed for AuthenticatedRequest
  });
}
