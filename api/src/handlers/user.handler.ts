import { FastifyReply, FastifyRequest } from 'fastify';
import {
  getAllUserNames,
  createUser,
  UserExistsError,
} from '../services/user.service';
import { CreateUserBody, UpdateUserBody } from '../types/user.types';
import { AuthenticatedRequest } from '../decorators/auth.decorators';
import prisma from '../lib/prisma';

/**
 * Lists all users (returns usernames only)
 * GET /api/user
 * Requires API key authentication
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Array of usernames
 */
export async function getUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const usernames = await getAllUserNames();
    return reply.status(200).send(usernames);
  } catch (error) {
    request.log.error({ error }, 'Error listing users');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred listing users',
    });
  }
}

/**
 * Creates a new user
 * POST /api/user
 * Public or admin-only based on ALLOW_PUBLIC_REGISTRATION config
 *
 * @param request - Fastify request with user data
 * @param reply - Fastify reply
 * @returns Created user (without password)
 */
export async function createUserHandler(
  request: FastifyRequest<{ Body: CreateUserBody }>,
  reply: FastifyReply,
) {
  try {
    const { name, email, password } = request.body;

    request.log.info({ name, email }, 'Creating user');

    const user = await createUser(name, email, password);

    return reply.status(201).send(user);
  } catch (error) {
    if (error instanceof UserExistsError) {
      return reply.conflict(error.message);
    }

    request.log.error({ error }, 'Error creating user');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred creating user',
    });
  }
}

/**
 * Gets a single user by ID
 * GET /api/user/:id
 * Requires authentication
 *
 * @param request - Authenticated Fastify request with user ID
 * @param reply - Fastify reply
 * @returns User details (without password)
 */
export async function getUserHandler(
  request: AuthenticatedRequest & {
    params: { id: string };
  },
  reply: FastifyReply,
) {
  try {
    const userId = parseInt(request.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        apiKeys: {
          select: {
            id: true,
            apiKey: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return reply.status(200).send({
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      confirmedAt: user.confirmedAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: user.roles.map((role) => role.name),
      apiKeys: user.apiKeys.map((key) => ({
        id: key.id,
        apiKey: key.apiKey,
        createdAt: key.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    request.log.error({ error }, 'Error fetching user');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching user',
    });
  }
}

/**
 * Updates a user
 * PUT /api/user/:id
 * Requires authentication (can only update own user unless admin)
 *
 * @param request - Authenticated Fastify request with user ID and update data
 * @param reply - Fastify reply
 * @returns Updated user (without password)
 */
export async function updateUserHandler(
  request: AuthenticatedRequest & {
    params: { id: string };
    body: UpdateUserBody;
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

    const userId = parseInt(request.params.id);
    const currentUserId = request.user.id;
    const isAdmin = request.user.roles.includes('admin');

    // Check if user can update this account
    if (userId !== currentUserId && !isAdmin) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only update your own account',
      });
    }

    const { name, email, password, active } = request.body;

    request.log.info({ userId }, 'Updating user');

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (active !== undefined && isAdmin) updateData.active = active; // Only admins can change active status

    // Hash password if provided
    if (password !== undefined) {
      const bcrypt = await import('bcrypt');
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { roles: true },
    });

    request.log.info({ userId }, 'User updated');

    return reply.status(200).send({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      active: updatedUser.active,
      confirmedAt: updatedUser.confirmedAt?.toISOString() || null,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
      roles: updatedUser.roles.map((role) => role.name),
    });
  } catch (error) {
    request.log.error({ error }, 'Error updating user');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred updating user',
    });
  }
}

/**
 * Deletes a user
 * DELETE /api/user/:id
 * Requires admin role
 *
 * @param request - Authenticated Fastify request with user ID
 * @param reply - Fastify reply
 * @returns Success message
 */
export async function deleteUserHandler(
  request: AuthenticatedRequest & {
    params: { id: string };
  },
  reply: FastifyReply,
) {
  try {
    const userId = parseInt(request.params.id);

    request.log.info({ userId }, 'Deleting user');

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Delete user (cascade will delete related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    request.log.info({ userId }, 'User deleted');

    return reply.status(200).send({
      message: 'User deleted successfully',
    });
  } catch (error) {
    request.log.error({ error }, 'Error deleting user');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred deleting user',
    });
  }
}
