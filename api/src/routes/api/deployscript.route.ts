/**
 * Deploy Script API Routes
 */

import { FastifyInstance } from 'fastify';
import {
  createDeployScriptHandler,
  listDeployScriptsHandler,
  getDeployScriptHandler,
  getDeployScriptRenderedHandler,
  updateDeployScriptHandler,
  deleteDeployScriptHandler,
} from '../../handlers/deployscript.handler';
import { requireAuth, requireRole } from '../../lib/auth';

export async function deployScriptRoutes(fastify: FastifyInstance) {
  // Schema definitions
  const createDeployScriptSchema = {
    body: {
      type: 'object',
      required: ['name', 'script'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'Display name of the deploy script (e.g., "Ubuntu - Dionaea")',
        },
        script: {
          type: 'string',
          minLength: 1,
          description: 'Shell script content with optional template variables',
        },
        notes: {
          type: 'string',
          description: 'Optional notes and documentation about the script',
        },
      },
      additionalProperties: false,
    },
  };

  const updateDeployScriptSchema = {
    body: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'Display name of the deploy script',
        },
        script: {
          type: 'string',
          minLength: 1,
          description: 'Shell script content',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the script',
        },
      },
      additionalProperties: false,
    },
  };

  const renderDeployScriptSchema = {
    body: {
      type: 'object',
      properties: {
        variables: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Template variables to substitute in script',
          example: {
            server_url: 'https://mhn.example.com',
            deploy_key: 'abc123def456',
            sensor_uuid: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      },
      additionalProperties: false,
    },
  };

  const paramsSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Deploy script ID',
        },
      },
    },
  };

  const querySchema = {
    querystring: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Filter scripts by user ID (admin only)',
        },
        search: {
          type: 'string',
          minLength: 1,
          description: 'Search scripts by name or notes',
        },
      },
      additionalProperties: false,
    },
  };

  /**
   * POST /api/deployscript - Create deploy script
   * Requires: api_key authentication
   */
  fastify.post(
    '/deployscript',
    {
      schema: createDeployScriptSchema,
      onRequest: [requireAuth],
    },
    createDeployScriptHandler
  );

  /**
   * GET /api/deployscript - List deploy scripts
   * Requires: api_key authentication
   */
  fastify.get(
    '/deployscript',
    {
      schema: querySchema,
      onRequest: [requireAuth],
    },
    listDeployScriptsHandler
  );

  /**
   * GET /api/deployscript/:id - Get single deploy script
   * Requires: api_key authentication
   */
  fastify.get(
    '/deployscript/:id',
    {
      schema: paramsSchema,
      onRequest: [requireAuth],
    },
    getDeployScriptHandler
  );

  /**
   * POST /api/deployscript/:id/render - Get script with variables rendered
   * Requires: api_key authentication
   * Returns: text/plain content
   */
  fastify.post(
    '/deployscript/:id/render',
    {
      schema: {
        ...paramsSchema,
        ...renderDeployScriptSchema,
      },
      onRequest: [requireAuth],
    },
    getDeployScriptRenderedHandler
  );

  /**
   * PUT /api/deployscript/:id - Update deploy script
   * Requires: api_key authentication
   */
  fastify.put(
    '/deployscript/:id',
    {
      schema: {
        ...paramsSchema,
        ...updateDeployScriptSchema,
      },
      onRequest: [requireAuth],
    },
    updateDeployScriptHandler
  );

  /**
   * DELETE /api/deployscript/:id - Delete deploy script
   * Requires: api_key authentication
   */
  fastify.delete(
    '/deployscript/:id',
    {
      schema: paramsSchema,
      onRequest: [requireAuth],
    },
    deleteDeployScriptHandler
  );
}
