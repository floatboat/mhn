// src/decorators/auth.decorators.ts
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

/**
 * Extended FastifyRequest interface with user information
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: number;
    email: string;
    name: string;
    roles: string[];
  };
}

/**
 * JWT payload interface
 */
interface JwtPayload {
  userId: number;
  email: string;
  name: string;
  type: 'access' | 'refresh';
}

/**
 * Authentication guard - Validates JWT token from Authorization header
 * Attaches user object to request if valid
 *
 * @throws 401 Unauthorized if token is missing or invalid
 * @throws 401 Unauthorized if user not found or inactive
 */
export const requireAuth: preHandlerHookHandler = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
) => {
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
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Token expired',
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
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
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    request.log.error({ error }, 'Error in requireAuth guard');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
};

/**
 * Role-based access control guard
 * Requires user to have a specific role
 * Must be used after requireAuth
 *
 * @param roleName - Required role name (e.g., 'admin', 'user')
 * @throws 401 Unauthorized if user not authenticated
 * @throws 403 Forbidden if user doesn't have required role
 */
export const requireRole = (roleName: string): preHandlerHookHandler => {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
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
    } catch (error) {
      request.log.error({ error, roleName }, 'Error in requireRole guard');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Authorization error',
      });
    }
  };
};

/**
 * API Key authentication guard
 * Validates API key from query parameter (?api_key=xxx)
 * Attaches user object to request if valid
 *
 * @throws 401 Unauthorized if API key is missing or invalid
 * @throws 401 Unauthorized if user not found or inactive
 */
export const requireApiKey: preHandlerHookHandler = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
) => {
  try {
    const apiKey = request.query as { api_key?: string };

    if (!apiKey.api_key) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing api_key query parameter',
      });
    }

    // Find API key in database with user and roles
    const apiKeyRecord = await prisma.apiKey.findUnique({
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
  } catch (error) {
    request.log.error({ error }, 'Error in requireApiKey guard');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
};

/**
 * Deploy Key authentication guard
 * Validates deploy key from query parameter (?deploy_key=xxx)
 * Used for sensor registration endpoints only
 * Does NOT attach user to request (sensors aren't users)
 *
 * @throws 401 Unauthorized if deploy key is missing or invalid
 * @throws 500 Internal Server Error if DEPLOY_KEY not configured
 */
export const requireDeployKey: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const deployKey = request.query as { deploy_key?: string };

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
  } catch (error) {
    request.log.error({ error }, 'Error in requireDeployKey guard');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
};
