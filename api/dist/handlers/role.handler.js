"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleNotFoundError = exports.RoleExistsError = void 0;
exports.listRolesHandler = listRolesHandler;
exports.createRoleHandler = createRoleHandler;
exports.getRoleHandler = getRoleHandler;
exports.updateRoleHandler = updateRoleHandler;
exports.assignRoleHandler = assignRoleHandler;
exports.removeRoleHandler = removeRoleHandler;
const prisma_1 = require("../lib/prisma");
/**
 * Custom error for role already exists
 */
class RoleExistsError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 409;
        this.name = 'RoleExistsError';
    }
}
exports.RoleExistsError = RoleExistsError;
/**
 * Custom error for role not found
 */
class RoleNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 404;
        this.name = 'RoleNotFoundError';
    }
}
exports.RoleNotFoundError = RoleNotFoundError;
/**
 * Lists all roles with user count
 * GET /api/role
 * Requires admin role
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Array of roles with user counts
 */
async function listRolesHandler(request, reply) {
    try {
        const roles = await prisma_1.prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
        const rolesWithCount = roles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
            userCount: role._count.users,
        }));
        return reply.status(200).send(rolesWithCount);
    }
    catch (error) {
        request.log.error({ error }, 'Error listing roles');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred listing roles',
        });
    }
}
/**
 * Creates a new role
 * POST /api/role
 * Requires admin role
 *
 * @param request - Fastify request with role data
 * @param reply - Fastify reply
 * @returns Created role
 */
async function createRoleHandler(request, reply) {
    try {
        const { name, description } = request.body;
        request.log.info({ name }, 'Creating role');
        // Check if role already exists
        const existingRole = await prisma_1.prisma.role.findUnique({
            where: { name },
        });
        if (existingRole) {
            throw new RoleExistsError(`Role '${name}' already exists`);
        }
        // Create role
        const role = await prisma_1.prisma.role.create({
            data: {
                name,
                description: description || null,
            },
        });
        request.log.info({ roleId: role.id, name: role.name }, 'Role created');
        return reply.status(201).send({
            id: role.id,
            name: role.name,
            description: role.description,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
        });
    }
    catch (error) {
        if (error instanceof RoleExistsError) {
            return reply.status(409).send({
                error: error.message,
            });
        }
        request.log.error({ error }, 'Error creating role');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred creating role',
        });
    }
}
/**
 * Gets a single role by ID
 * GET /api/role/:id
 * Requires authentication
 *
 * @param request - Fastify request with role ID
 * @param reply - Fastify reply
 * @returns Role details
 */
async function getRoleHandler(request, reply) {
    try {
        const roleId = parseInt(request.params.id);
        request.log.info({ roleId }, 'Getting role');
        // Find role with user count
        const role = await prisma_1.prisma.role.findUnique({
            where: { id: roleId },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });
        if (!role) {
            throw new RoleNotFoundError('Role not found');
        }
        return reply.status(200).send({
            id: role.id,
            name: role.name,
            description: role.description,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
            userCount: role._count.users,
        });
    }
    catch (error) {
        if (error instanceof RoleNotFoundError) {
            return reply.status(404).send({
                error: error.message,
            });
        }
        request.log.error({ error }, 'Error getting role');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred getting role',
        });
    }
}
/**
 * Updates a role
 * PUT /api/role/:id
 * Requires admin role
 *
 * @param request - Fastify request with role ID and update data
 * @param reply - Fastify reply
 * @returns Updated role
 */
async function updateRoleHandler(request, reply) {
    try {
        const roleId = parseInt(request.params.id);
        const { description } = request.body;
        request.log.info({ roleId }, 'Updating role');
        // Check if role exists
        const existingRole = await prisma_1.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!existingRole) {
            throw new RoleNotFoundError('Role not found');
        }
        // Update role
        const role = await prisma_1.prisma.role.update({
            where: { id: roleId },
            data: {
                description: description !== undefined ? description : undefined,
            },
        });
        request.log.info({ roleId: role.id }, 'Role updated');
        return reply.status(200).send({
            id: role.id,
            name: role.name,
            description: role.description,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
        });
    }
    catch (error) {
        if (error instanceof RoleNotFoundError) {
            return reply.status(404).send({
                error: error.message,
            });
        }
        request.log.error({ error }, 'Error updating role');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred updating role',
        });
    }
}
/**
 * Assigns a role to a user
 * POST /api/role/:roleId/assign/:userId
 * Requires admin role
 *
 * @param request - Fastify request with role ID and user ID
 * @param reply - Fastify reply
 * @returns Success message
 */
async function assignRoleHandler(request, reply) {
    try {
        const roleId = parseInt(request.params.roleId);
        const userId = parseInt(request.params.userId);
        request.log.info({ roleId, userId }, 'Assigning role to user');
        // Check if role exists
        const role = await prisma_1.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!role) {
            return reply.status(404).send({
                error: 'Role not found',
            });
        }
        // Check if user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
        });
        if (!user) {
            return reply.status(404).send({
                error: 'User not found',
            });
        }
        // Check if user already has this role
        if (user.roles.some((r) => r.id === roleId)) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'User already has this role',
            });
        }
        // Assign role to user
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                roles: {
                    connect: { id: roleId },
                },
            },
        });
        request.log.info({ roleId, userId }, 'Role assigned to user');
        return reply.status(200).send({
            message: `Role '${role.name}' assigned to user successfully`,
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error assigning role to user');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred assigning role',
        });
    }
}
/**
 * Removes a role from a user
 * DELETE /api/role/:roleId/assign/:userId
 * Requires admin role
 *
 * @param request - Fastify request with role ID and user ID
 * @param reply - Fastify reply
 * @returns Success message
 */
async function removeRoleHandler(request, reply) {
    try {
        const roleId = parseInt(request.params.roleId);
        const userId = parseInt(request.params.userId);
        request.log.info({ roleId, userId }, 'Removing role from user');
        // Check if role exists
        const role = await prisma_1.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!role) {
            return reply.status(404).send({
                error: 'Role not found',
            });
        }
        // Check if user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
        });
        if (!user) {
            return reply.status(404).send({
                error: 'User not found',
            });
        }
        // Check if user has this role
        if (!user.roles.some((r) => r.id === roleId)) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'User does not have this role',
            });
        }
        // Remove role from user
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                roles: {
                    disconnect: { id: roleId },
                },
            },
        });
        request.log.info({ roleId, userId }, 'Role removed from user');
        return reply.status(200).send({
            message: `Role '${role.name}' removed from user successfully`,
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error removing role from user');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred removing role',
        });
    }
}
