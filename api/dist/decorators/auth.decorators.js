"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeployKey = exports.requireApiKey = exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
/**
 * Authentication guard - Validates JWT token from Authorization header
 * Attaches user object to request if valid
 *
 * @throws 401 Unauthorized if token is missing or invalid
 * @throws 401 Unauthorized if user not found or inactive
 */
const requireAuth = async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header',
            });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (!process.env.JWT_SECRET) {
            request.log.error('JWT_SECRET environment variable not set');
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Server configuration error',
            });
        }
        // Verify and decode token
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                return reply.status(401).send({
                    error: 'Unauthorized',
                    message: 'Token expired',
                });
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                return reply.status(401).send({
                    error: 'Unauthorized',
                    message: 'Invalid token',
                });
            }
            throw error;
        }
        // Verify it's an access token
        if (decoded.type !== 'access') {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid token type',
            });
        }
        // Fetch user from database with roles
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { roles: true },
        });
        if (!user) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'User not found',
            });
        }
        if (!user.active) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'User account is disabled',
            });
        }
        // Attach user to request
        request.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles.map((role) => role.name),
        };
    }
    catch (error) {
        request.log.error({ error }, 'Error in requireAuth guard');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Authentication error',
        });
    }
};
exports.requireAuth = requireAuth;
/**
 * Role-based access control guard
 * Requires user to have a specific role
 * Must be used after requireAuth
 *
 * @param roleName - Required role name (e.g., 'admin', 'user')
 * @throws 401 Unauthorized if user not authenticated
 * @throws 403 Forbidden if user doesn't have required role
 */
const requireRole = (roleName) => {
    return async (request, reply) => {
        try {
            // Check if user is authenticated
            if (!request.user) {
                return reply.status(401).send({
                    error: 'Unauthorized',
                    message: 'Authentication required',
                });
            }
            // Check if user has the required role
            if (!request.user.roles.includes(roleName)) {
                return reply.status(403).send({
                    error: 'Forbidden',
                    message: `Required role: ${roleName}`,
                });
            }
        }
        catch (error) {
            request.log.error({ error, roleName }, 'Error in requireRole guard');
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Authorization error',
            });
        }
    };
};
exports.requireRole = requireRole;
/**
 * API Key authentication guard
 * Validates API key from query parameter (?api_key=xxx)
 * Attaches user object to request if valid
 *
 * @throws 401 Unauthorized if API key is missing or invalid
 * @throws 401 Unauthorized if user not found or inactive
 */
const requireApiKey = async (request, reply) => {
    try {
        const apiKey = request.query;
        if (!apiKey.api_key) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Missing api_key query parameter',
            });
        }
        // Find API key in database with user and roles
        const apiKeyRecord = await prisma_1.prisma.apiKey.findUnique({
            where: { apiKey: apiKey.api_key },
            include: {
                user: {
                    include: { roles: true },
                },
            },
        });
        if (!apiKeyRecord) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid API key',
            });
        }
        if (!apiKeyRecord.user.active) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'User account is disabled',
            });
        }
        // Attach user to request
        request.user = {
            id: apiKeyRecord.user.id,
            email: apiKeyRecord.user.email,
            name: apiKeyRecord.user.name,
            roles: apiKeyRecord.user.roles.map((role) => role.name),
        };
    }
    catch (error) {
        request.log.error({ error }, 'Error in requireApiKey guard');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Authentication error',
        });
    }
};
exports.requireApiKey = requireApiKey;
/**
 * Deploy Key authentication guard
 * Validates deploy key from query parameter (?deploy_key=xxx)
 * Used for sensor registration endpoints only
 * Does NOT attach user to request (sensors aren't users)
 *
 * @throws 401 Unauthorized if deploy key is missing or invalid
 * @throws 500 Internal Server Error if DEPLOY_KEY not configured
 */
const requireDeployKey = async (request, reply) => {
    try {
        const deployKey = request.query;
        if (!deployKey.deploy_key) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Missing deploy_key query parameter',
            });
        }
        if (!process.env.DEPLOY_KEY) {
            request.log.error('DEPLOY_KEY environment variable not set');
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Server configuration error',
            });
        }
        // Simple string comparison for deploy key
        if (deployKey.deploy_key !== process.env.DEPLOY_KEY) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid deploy key',
            });
        }
    }
    catch (error) {
        request.log.error({ error }, 'Error in requireDeployKey guard');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Authentication error',
        });
    }
};
exports.requireDeployKey = requireDeployKey;
