"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersHandler = getUsersHandler;
exports.createUserHandler = createUserHandler;
exports.getUserHandler = getUserHandler;
exports.updateUserHandler = updateUserHandler;
exports.deleteUserHandler = deleteUserHandler;
const user_service_1 = require("../services/user.service");
const prisma_1 = require("../lib/prisma");
/**
 * Lists all users (returns usernames only)
 * GET /api/user
 * Requires API key authentication
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Array of usernames
 */
async function getUsersHandler(request, reply) {
    try {
        const usernames = await (0, user_service_1.getAllUserNames)();
        return reply.status(200).send(usernames);
    }
    catch (error) {
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
async function createUserHandler(request, reply) {
    try {
        const { name, email, password } = request.body;
        request.log.info({ name, email }, 'Creating user');
        const user = await (0, user_service_1.createUser)(name, email, password);
        return reply.status(201).send(user);
    }
    catch (error) {
        if (error instanceof user_service_1.UserExistsError) {
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
async function getUserHandler(request, reply) {
    try {
        const userId = parseInt(request.params.id);
        const user = await prisma_1.prisma.user.findUnique({
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
    }
    catch (error) {
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
async function updateUserHandler(request, reply) {
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
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!existingUser) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'User not found',
            });
        }
        // Prepare update data
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (email !== undefined)
            updateData.email = email;
        if (active !== undefined && isAdmin)
            updateData.active = active; // Only admins can change active status
        // Hash password if provided
        if (password !== undefined) {
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
            updateData.password = await bcrypt.hash(password, 10);
        }
        // Update user
        const updatedUser = await prisma_1.prisma.user.update({
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
    }
    catch (error) {
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
async function deleteUserHandler(request, reply) {
    try {
        const userId = parseInt(request.params.id);
        request.log.info({ userId }, 'Deleting user');
        // Check if user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'User not found',
            });
        }
        // Delete user (cascade will delete related records)
        await prisma_1.prisma.user.delete({
            where: { id: userId },
        });
        request.log.info({ userId }, 'User deleted');
        return reply.status(200).send({
            message: 'User deleted successfully',
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error deleting user');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred deleting user',
        });
    }
}
