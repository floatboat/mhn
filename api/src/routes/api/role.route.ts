// src/routes/api/role.route.ts
import { FastifyInstance } from 'fastify';
import {
  listRolesHandler,
  createRoleHandler,
  getRoleHandler,
  updateRoleHandler,
  assignRoleHandler,
  removeRoleHandler,
} from '../../handlers/role.handler';
import {
  listRolesSchema,
  createRoleSchema,
  getRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  removeRoleSchema,
} from '../../types/role.types';
import { requireAuth, requireRole } from '../../decorators/auth.decorators';

/**
 * Role management routes
 * All routes are prefixed with /api/role
 * All routes require admin role
 */
export default async function roleRoutes(fastify: FastifyInstance) {
  /**
   * List all roles
   * GET /api/role
   * Requires admin role
   */
  fastify.route({
    method: 'GET',
    url: '/role',
    schema: listRolesSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: listRolesHandler,
  });

  /**
   * Create a new role
   * POST /api/role
   * Requires admin role
   */
  fastify.route({
    method: 'POST',
    url: '/role',
    schema: createRoleSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: createRoleHandler,
  });

  /**
   * Get a single role
   * GET /api/role/:id
   * Requires authentication
   */
  fastify.route({
    method: 'GET',
    url: '/role/:id',
    schema: getRoleSchema,
    preHandler: [requireAuth],
    handler: getRoleHandler,
  });

  /**
   * Update a role
   * PUT /api/role/:id
   * Requires admin role
   */
  fastify.route({
    method: 'PUT',
    url: '/role/:id',
    schema: updateRoleSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: updateRoleHandler,
  });

  /**
   * Assign role to user
   * POST /api/role/:roleId/assign/:userId
   * Requires admin role
   */
  fastify.route({
    method: 'POST',
    url: '/role/:roleId/assign/:userId',
    schema: assignRoleSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: assignRoleHandler,
  });

  /**
   * Remove role from user
   * DELETE /api/role/:roleId/assign/:userId
   * Requires admin role
   */
  fastify.route({
    method: 'DELETE',
    url: '/role/:roleId/assign/:userId',
    schema: removeRoleSchema,
    preHandler: [requireAuth, requireRole('admin')],
    handler: removeRoleHandler,
  });
}
