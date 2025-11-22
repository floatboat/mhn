"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = apikeyRoutes;
const apikey_handler_1 = require("../../handlers/apikey.handler");
const apikey_types_1 = require("../../types/apikey.types");
const auth_decorators_1 = require("../../decorators/auth.decorators");
/**
 * API Key management routes
 * All routes are prefixed with /api/apikey
 */
async function apikeyRoutes(fastify) {
    /**
     * List all API keys
     * GET /api/apikey
     * Requires admin role
     */
    fastify.route({
        method: 'GET',
        url: '/apikey',
        schema: apikey_types_1.listApiKeysSchema,
        preHandler: [auth_decorators_1.requireAuth, (0, auth_decorators_1.requireRole)('admin')],
        handler: apikey_handler_1.listApiKeysHandler,
    });
    /**
     * Create a new API key for authenticated user
     * POST /api/apikey
     * Requires authentication
     */
    fastify.route({
        method: 'POST',
        url: '/apikey',
        schema: apikey_types_1.createApiKeySchema,
        preHandler: auth_decorators_1.requireAuth,
        handler: apikey_handler_1.createApiKeyHandler,
    });
    /**
     * Delete an API key
     * DELETE /api/apikey/:id
     * Requires authentication (can only delete own keys unless admin)
     */
    fastify.route({
        method: 'DELETE',
        url: '/apikey/:id',
        schema: apikey_types_1.deleteApiKeySchema,
        preHandler: auth_decorators_1.requireAuth,
        handler: apikey_handler_1.deleteApiKeyHandler, // Type assertion needed for AuthenticatedRequest
    });
}
