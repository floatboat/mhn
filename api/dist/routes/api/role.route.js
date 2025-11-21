"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = roleRoutes;
const role_handler_1 = require("../../handlers/role.handler");
const role_types_1 = require("../../types/role.types");
const auth_decorators_1 = require("../../decorators/auth.decorators");
/**
 * Role management routes
 * All routes are prefixed with /api/role
 * All routes require admin role
 */
async function roleRoutes(fastify) {
    /**
     * List all roles
     * GET /api/role
     * Requires admin role
     */
    fastify.route({
        method: 'GET',
        url: '/role',
        schema: role_types_1.listRolesSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: role_handler_1.listRolesHandler,
    });
    /**
     * Create a new role
     * POST /api/role
     * Requires admin role
     */
    fastify.route({
        method: 'POST',
        url: '/role',
        schema: role_types_1.createRoleSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: role_handler_1.createRoleHandler,
    });
    /**
     * Update a role
     * PUT /api/role/:id
     * Requires admin role
     */
    fastify.route({
        method: 'PUT',
        url: '/role/:id',
        schema: role_types_1.updateRoleSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: role_handler_1.updateRoleHandler,
    });
    /**
     * Assign role to user
     * POST /api/role/:roleId/assign/:userId
     * Requires admin role
     */
    fastify.route({
        method: 'POST',
        url: '/role/:roleId/assign/:userId',
        schema: role_types_1.assignRoleSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: role_handler_1.assignRoleHandler,
    });
    /**
     * Remove role from user
     * DELETE /api/role/:roleId/assign/:userId
     * Requires admin role
     */
    fastify.route({
        method: 'DELETE',
        url: '/role/:roleId/assign/:userId',
        schema: role_types_1.removeRoleSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: role_handler_1.removeRoleHandler,
    });
}
