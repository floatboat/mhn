"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserLacksRoleError = exports.UserHasRoleError = exports.RoleExistsError = exports.RoleNotFoundError = void 0;
exports.createRole = createRole;
exports.getRoleById = getRoleById;
exports.getRoleByName = getRoleByName;
exports.getAllRoles = getAllRoles;
exports.assignRoleToUser = assignRoleToUser;
exports.assignRoleToUserByName = assignRoleToUserByName;
exports.removeRoleFromUser = removeRoleFromUser;
exports.removeRoleFromUserByName = removeRoleFromUserByName;
exports.getUserRoles = getUserRoles;
exports.userHasRole = userHasRole;
exports.userHasAnyRole = userHasAnyRole;
exports.userHasAllRoles = userHasAllRoles;
exports.deleteRole = deleteRole;
exports.updateRoleDescription = updateRoleDescription;
const prisma_1 = require("../lib/prisma");
/**
 * Custom error for role not found
 */
class RoleNotFoundError extends Error {
    constructor(message = 'Role not found') {
        super(message);
        this.name = 'RoleNotFoundError';
    }
}
exports.RoleNotFoundError = RoleNotFoundError;
/**
 * Custom error for role already exists
 */
class RoleExistsError extends Error {
    constructor(message = 'Role already exists') {
        super(message);
        this.name = 'RoleExistsError';
    }
}
exports.RoleExistsError = RoleExistsError;
/**
 * Custom error for user already has role
 */
class UserHasRoleError extends Error {
    constructor(message = 'User already has this role') {
        super(message);
        this.name = 'UserHasRoleError';
    }
}
exports.UserHasRoleError = UserHasRoleError;
/**
 * Custom error for user doesn't have role
 */
class UserLacksRoleError extends Error {
    constructor(message = 'User does not have this role') {
        super(message);
        this.name = 'UserLacksRoleError';
    }
}
exports.UserLacksRoleError = UserLacksRoleError;
/**
 * Creates a new role
 * @param name - Role name (e.g., 'admin', 'user')
 * @param description - Optional role description
 * @returns Created role object
 * @throws RoleExistsError if role with the same name already exists
 */
async function createRole(name, description) {
    // Check if role already exists
    const existingRole = await prisma_1.prisma.role.findUnique({
        where: { name },
    });
    if (existingRole) {
        throw new RoleExistsError(`Role with name '${name}' already exists`);
    }
    // Create role
    const role = await prisma_1.prisma.role.create({
        data: {
            name,
            description: description || null,
        },
    });
    return role;
}
/**
 * Gets a role by ID
 * @param roleId - Role ID
 * @returns Role object
 * @throws RoleNotFoundError if role doesn't exist
 */
async function getRoleById(roleId) {
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: roleId },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }
    return role;
}
/**
 * Gets a role by name
 * @param name - Role name
 * @returns Role object
 * @throws RoleNotFoundError if role doesn't exist
 */
async function getRoleByName(name) {
    const role = await prisma_1.prisma.role.findUnique({
        where: { name },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with name '${name}' not found`);
    }
    return role;
}
/**
 * Lists all roles
 * @returns Array of all roles
 */
async function getAllRoles() {
    return prisma_1.prisma.role.findMany({
        orderBy: {
            name: 'asc',
        },
    });
}
/**
 * Assigns a role to a user
 * @param userId - User ID
 * @param roleId - Role ID
 * @returns Updated user object with roles
 * @throws RoleNotFoundError if role doesn't exist
 * @throws UserHasRoleError if user already has the role
 */
async function assignRoleToUser(userId, roleId) {
    // Verify role exists
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: roleId },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }
    // Verify user exists
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });
    if (!user) {
        throw new Error('User not found');
    }
    // Check if user already has this role
    const hasRole = user.roles.some((r) => r.id === roleId);
    if (hasRole) {
        throw new UserHasRoleError(`User already has role '${role.name}'`);
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
}
/**
 * Assigns a role to a user by role name
 * Convenience method for assigning roles by name instead of ID
 * @param userId - User ID
 * @param roleName - Role name (e.g., 'admin', 'user')
 * @throws RoleNotFoundError if role doesn't exist
 * @throws UserHasRoleError if user already has the role
 */
async function assignRoleToUserByName(userId, roleName) {
    const role = await getRoleByName(roleName);
    await assignRoleToUser(userId, role.id);
}
/**
 * Removes a role from a user
 * @param userId - User ID
 * @param roleId - Role ID
 * @returns Updated user object with roles
 * @throws RoleNotFoundError if role doesn't exist
 * @throws UserLacksRoleError if user doesn't have the role
 */
async function removeRoleFromUser(userId, roleId) {
    // Verify role exists
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: roleId },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }
    // Verify user exists and has the role
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });
    if (!user) {
        throw new Error('User not found');
    }
    // Check if user has this role
    const hasRole = user.roles.some((r) => r.id === roleId);
    if (!hasRole) {
        throw new UserLacksRoleError(`User does not have role '${role.name}'`);
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
}
/**
 * Removes a role from a user by role name
 * Convenience method for removing roles by name instead of ID
 * @param userId - User ID
 * @param roleName - Role name (e.g., 'admin', 'user')
 * @throws RoleNotFoundError if role doesn't exist
 * @throws UserLacksRoleError if user doesn't have the role
 */
async function removeRoleFromUserByName(userId, roleName) {
    const role = await getRoleByName(roleName);
    await removeRoleFromUser(userId, role.id);
}
/**
 * Gets all roles for a user
 * @param userId - User ID
 * @returns Array of role objects
 */
async function getUserRoles(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: true,
        },
    });
    if (!user) {
        throw new Error('User not found');
    }
    return user.roles;
}
/**
 * Checks if a user has a specific role
 * @param userId - User ID
 * @param roleName - Role name to check (e.g., 'admin', 'user')
 * @returns True if user has the role
 */
async function userHasRole(userId, roleName) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: {
                where: {
                    name: roleName,
                },
            },
        },
    });
    if (!user) {
        return false;
    }
    return user.roles.length > 0;
}
/**
 * Checks if a user has any of the specified roles
 * @param userId - User ID
 * @param roleNames - Array of role names to check
 * @returns True if user has at least one of the roles
 */
async function userHasAnyRole(userId, roleNames) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: {
                where: {
                    name: {
                        in: roleNames,
                    },
                },
            },
        },
    });
    if (!user) {
        return false;
    }
    return user.roles.length > 0;
}
/**
 * Checks if a user has all of the specified roles
 * @param userId - User ID
 * @param roleNames - Array of role names to check
 * @returns True if user has all of the roles
 */
async function userHasAllRoles(userId, roleNames) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: true,
        },
    });
    if (!user) {
        return false;
    }
    // Check if user has all required roles
    return roleNames.every((roleName) => user.roles.some((role) => role.name === roleName));
}
/**
 * Deletes a role
 * Note: This will also remove the role from all users
 * @param roleId - Role ID to delete
 * @returns True if deletion was successful
 * @throws RoleNotFoundError if role doesn't exist
 */
async function deleteRole(roleId) {
    // Verify role exists
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: roleId },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }
    // Delete role (cascade will remove from users)
    await prisma_1.prisma.role.delete({
        where: { id: roleId },
    });
    return true;
}
/**
 * Updates a role's description
 * @param roleId - Role ID
 * @param description - New description
 * @returns Updated role object
 * @throws RoleNotFoundError if role doesn't exist
 */
async function updateRoleDescription(roleId, description) {
    // Verify role exists
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: roleId },
    });
    if (!role) {
        throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }
    // Update role
    return prisma_1.prisma.role.update({
        where: { id: roleId },
        data: { description },
    });
}
