"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyNotFoundError = void 0;
exports.listApiKeysHandler = listApiKeysHandler;
exports.createApiKeyHandler = createApiKeyHandler;
exports.deleteApiKeyHandler = deleteApiKeyHandler;
const prisma_1 = require("../lib/prisma");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Custom error for API key not found
 */
class ApiKeyNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 404;
        this.name = 'ApiKeyNotFoundError';
    }
}
exports.ApiKeyNotFoundError = ApiKeyNotFoundError;
/**
 * Generates a random API key (UUID without dashes - 32 characters)
 * @returns Random API key string
 */
function generateApiKey() {
    return crypto_1.default.randomUUID().replace(/-/g, '');
}
/**
 * Lists all API keys
 * GET /api/apikey
 * Requires admin role
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Array of API keys with user info
 */
async function listApiKeysHandler(request, reply) {
    try {
        const apiKeys = await prisma_1.prisma.apiKey.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const apiKeysList = apiKeys.map((key) => ({
            id: key.id,
            apiKey: key.apiKey,
            createdAt: key.createdAt.toISOString(),
            user: {
                id: key.user.id,
                name: key.user.name,
                email: key.user.email,
            },
        }));
        return reply.status(200).send(apiKeysList);
    }
    catch (error) {
        request.log.error({ error }, 'Error listing API keys');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred listing API keys',
        });
    }
}
/**
 * Creates a new API key for the authenticated user
 * POST /api/apikey
 * Requires authentication
 *
 * @param request - Authenticated Fastify request
 * @param reply - Fastify reply
 * @returns Created API key
 */
async function createApiKeyHandler(request, reply) {
    try {
        if (!request.user) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }
        const userId = request.user.id;
        request.log.info({ userId }, 'Creating API key');
        // Generate unique API key
        let apiKeyStr;
        let isUnique = false;
        // Keep generating until we get a unique key (very unlikely to collide)
        while (!isUnique) {
            apiKeyStr = generateApiKey();
            const existing = await prisma_1.prisma.apiKey.findUnique({
                where: { apiKey: apiKeyStr },
            });
            if (!existing) {
                isUnique = true;
            }
        }
        // Create API key
        const apiKey = await prisma_1.prisma.apiKey.create({
            data: {
                apiKey: apiKeyStr,
                userId,
            },
        });
        request.log.info({ apiKeyId: apiKey.id, userId }, 'API key created');
        return reply.status(201).send({
            id: apiKey.id,
            apiKey: apiKey.apiKey,
            createdAt: apiKey.createdAt.toISOString(),
            userId: apiKey.userId,
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error creating API key');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred creating API key',
        });
    }
}
/**
 * Deletes an API key
 * DELETE /api/apikey/:id
 * Requires authentication (can only delete own API keys unless admin)
 *
 * @param request - Authenticated Fastify request with API key ID
 * @param reply - Fastify reply
 * @returns Success message
 */
async function deleteApiKeyHandler(request, reply) {
    try {
        if (!request.user) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }
        const apiKeyId = parseInt(request.params.id);
        const userId = request.user.id;
        const isAdmin = request.user.roles.includes('admin');
        request.log.info({ apiKeyId, userId }, 'Deleting API key');
        // Find the API key
        const apiKey = await prisma_1.prisma.apiKey.findUnique({
            where: { id: apiKeyId },
        });
        if (!apiKey) {
            throw new ApiKeyNotFoundError('API key not found');
        }
        // Check if user owns this API key or is admin
        if (apiKey.userId !== userId && !isAdmin) {
            return reply.status(403).send({
                error: 'Cannot delete API key that belongs to another user',
            });
        }
        // Delete API key
        await prisma_1.prisma.apiKey.delete({
            where: { id: apiKeyId },
        });
        request.log.info({ apiKeyId }, 'API key deleted');
        return reply.status(200).send({
            message: 'API key deleted successfully',
        });
    }
    catch (error) {
        if (error instanceof ApiKeyNotFoundError) {
            return reply.status(404).send({
                error: error.message,
            });
        }
        request.log.error({ error }, 'Error deleting API key');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred deleting API key',
        });
    }
}
