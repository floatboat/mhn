"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const auth_handler_1 = require("../../handlers/auth.handler");
const auth_types_1 = require("../../types/auth.types");
const auth_decorators_1 = require("../../decorators/auth.decorators");
/**
 * Authentication routes
 * All routes are prefixed with /api/auth
 */
async function authRoutes(fastify) {
    /**
     * Login endpoint
     * POST /api/auth/login
     * Public endpoint
     */
    fastify.route({
        method: 'POST',
        url: '/auth/login',
        schema: auth_types_1.loginSchema,
        handler: auth_handler_1.loginHandler,
    });
    /**
     * Logout endpoint
     * POST /api/auth/logout
     * Public endpoint (but requires refresh token)
     */
    fastify.route({
        method: 'POST',
        url: '/auth/logout',
        schema: auth_types_1.refreshSchema, // Uses same schema as refresh (requires refreshToken)
        handler: auth_handler_1.logoutHandler,
    });
    /**
     * Refresh token endpoint
     * POST /api/auth/refresh
     * Public endpoint (but requires refresh token)
     */
    fastify.route({
        method: 'POST',
        url: '/auth/refresh',
        schema: auth_types_1.refreshSchema,
        handler: auth_handler_1.refreshHandler,
    });
    /**
     * Get current user info
     * GET /api/auth/me
     * Requires authentication
     */
    fastify.route({
        method: 'GET',
        url: '/auth/me',
        schema: auth_types_1.userInfoSchema,
        preHandler: auth_decorators_1.requireAuth,
        handler: auth_handler_1.getMeHandler,
    });
    /**
     * Request password reset
     * POST /api/auth/reset-request
     * Public endpoint
     */
    fastify.route({
        method: 'POST',
        url: '/auth/reset-request',
        schema: auth_types_1.resetRequestSchema,
        handler: auth_handler_1.resetRequestHandler,
    });
    /**
     * Confirm password reset
     * POST /api/auth/reset-confirm
     * Public endpoint
     */
    fastify.route({
        method: 'POST',
        url: '/auth/reset-confirm',
        schema: auth_types_1.resetConfirmSchema,
        handler: auth_handler_1.resetConfirmHandler,
    });
}
