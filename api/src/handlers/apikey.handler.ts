// src/handlers/apikey.handler.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../decorators/auth.decorators';
import crypto from 'crypto';

/**
 * Custom error for API key not found
 */
export class ApiKeyNotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyNotFoundError';
  }
}

/**
 * Generates a random API key (UUID without dashes - 32 characters)
 * @returns Random API key string
 */
function generateApiKey(): string {
  return crypto.randomUUID().replace(/-/g, '');
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
export async function listApiKeysHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const apiKeys = await prisma.apiKey.findMany({
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
  } catch (error) {
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
export async function createApiKeyHandler(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
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
    let apiKeyStr: string;
    let isUnique = false;

    // Keep generating until we get a unique key (very unlikely to collide)
    while (!isUnique) {
      apiKeyStr = generateApiKey();

      const existing = await prisma.apiKey.findUnique({
        where: { apiKey: apiKeyStr },
      });

      if (!existing) {
        isUnique = true;
      }
    }

    // Create API key
    const apiKey = await prisma.apiKey.create({
      data: {
        apiKey: apiKeyStr!,
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
  } catch (error) {
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
export async function deleteApiKeyHandler(
  request: AuthenticatedRequest & {
    params: { id: string };
  },
  reply: FastifyReply,
) {
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
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new ApiKeyNotFoundError('API key not found');
    }

    // Check if user owns this API key or is admin
    if (apiKey.userId !== userId && !isAdmin) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only delete your own API keys',
      });
    }

    // Delete API key
    await prisma.apiKey.delete({
      where: { id: apiKeyId },
    });

    request.log.info({ apiKeyId }, 'API key deleted');

    return reply.status(200).send({
      message: 'API key deleted successfully',
    });
  } catch (error) {
    if (error instanceof ApiKeyNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: error.message,
      });
    }

    request.log.error({ error }, 'Error deleting API key');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred deleting API key',
    });
  }
}
