"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserNotFoundError = exports.UserExistsError = void 0;
exports.getAllUserNames = getAllUserNames;
exports.createUser = createUser;
exports.verifyPassword = verifyPassword;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.getUserByName = getUserByName;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.activateUser = activateUser;
exports.deactivateUser = deactivateUser;
exports.confirmUserEmail = confirmUserEmail;
exports.getAllUsers = getAllUsers;
exports.countUsers = countUsers;
exports.userExistsByEmail = userExistsByEmail;
exports.userExistsByName = userExistsByName;
const prisma_1 = require("../lib/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 10; // Industry standard
/**
 * Custom error for user already exists
 */
class UserExistsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UserExistsError';
    }
}
exports.UserExistsError = UserExistsError;
/**
 * Custom error for user not found
 */
class UserNotFoundError extends Error {
    constructor(message = 'User not found') {
        super(message);
        this.name = 'UserNotFoundError';
    }
}
exports.UserNotFoundError = UserNotFoundError;
async function getAllUserNames() {
    const users = await prisma_1.prisma.user.findMany({
        select: {
            name: true,
        },
    });
    return users.map((user) => user.name);
}
// TODO: Consider using typebox for validation and creating different types for request and response (ie. userWIthoutPassword).
async function createUser(name, email, password) {
    // Check if user exists by name or email
    const existingUser = await prisma_1.prisma.user.findFirst({
        where: {
            OR: [{ name }, { email }],
        },
    });
    if (existingUser) {
        const field = existingUser.name === name ? 'name' : 'email';
        throw new UserExistsError(`User with this ${field} already exists`);
    }
    // Hash password before storing
    const hashedPassword = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    const user = await prisma_1.prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
    });
    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
/**
 * Verifies a plain text password against a hashed password
 * Used for login authentication
 * @param plainPassword - Plain text password to verify
 * @param hashedPassword - Hashed password from database
 * @returns True if password matches
 */
async function verifyPassword(plainPassword, hashedPassword) {
    return bcrypt_1.default.compare(plainPassword, hashedPassword);
}
/**
 * Gets a user by ID
 * @param id - User ID
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
async function getUserById(id) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            confirmedAt: true,
            createdAt: true,
            updatedAt: true,
            password: false, // Explicitly exclude password
        },
    });
    if (!user) {
        throw new UserNotFoundError(`User with ID ${id} not found`);
    }
    return user;
}
/**
 * Gets a user by email
 * @param email - User's email address
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
async function getUserByEmail(email) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            confirmedAt: true,
            createdAt: true,
            updatedAt: true,
            password: false, // Explicitly exclude password
        },
    });
    if (!user) {
        throw new UserNotFoundError(`User with email '${email}' not found`);
    }
    return user;
}
/**
 * Gets a user by username
 * @param name - Username
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
async function getUserByName(name) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { name },
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            confirmedAt: true,
            createdAt: true,
            updatedAt: true,
            password: false, // Explicitly exclude password
        },
    });
    if (!user) {
        throw new UserNotFoundError(`User with name '${name}' not found`);
    }
    return user;
}
/**
 * Updates a user's information
 * @param id - User ID
 * @param data - Fields to update
 * @returns Updated user object without password
 * @throws UserNotFoundError if user doesn't exist
 * @throws UserExistsError if email or name is already taken
 */
async function updateUser(id, data) {
    // Verify user exists
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { id },
    });
    if (!existingUser) {
        throw new UserNotFoundError(`User with ID ${id} not found`);
    }
    // Check if email or name is being changed to an already-used value
    if (data.email || data.name) {
        const conflictingUser = await prisma_1.prisma.user.findFirst({
            where: {
                AND: [
                    { id: { not: id } }, // Exclude current user
                    {
                        OR: [
                            data.email ? { email: data.email } : {},
                            data.name ? { name: data.name } : {},
                        ],
                    },
                ],
            },
        });
        if (conflictingUser) {
            if (conflictingUser.email === data.email) {
                throw new UserExistsError('Email is already taken');
            }
            if (conflictingUser.name === data.name) {
                throw new UserExistsError('Username is already taken');
            }
        }
    }
    // Update user
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            confirmedAt: true,
            createdAt: true,
            updatedAt: true,
            password: false, // Explicitly exclude password
        },
    });
    return updatedUser;
}
/**
 * Deletes a user
 * This will cascade delete related records (API keys, reset tokens, etc.)
 * @param id - User ID
 * @returns True if deletion was successful
 * @throws UserNotFoundError if user doesn't exist
 */
async function deleteUser(id) {
    // Verify user exists
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
    });
    if (!user) {
        throw new UserNotFoundError(`User with ID ${id} not found`);
    }
    // Delete user (cascade will handle related records)
    await prisma_1.prisma.user.delete({
        where: { id },
    });
    return true;
}
/**
 * Activates a user account
 * Sets active field to true
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
async function activateUser(id) {
    return updateUser(id, { active: true });
}
/**
 * Deactivates a user account
 * Sets active field to false
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
async function deactivateUser(id) {
    return updateUser(id, { active: false });
}
/**
 * Confirms a user's email
 * Sets confirmedAt to current timestamp
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
async function confirmUserEmail(id) {
    return updateUser(id, { confirmedAt: new Date() });
}
/**
 * Lists all users with optional filtering
 * @param includeInactive - Whether to include inactive users (default: true)
 * @returns Array of user objects without passwords
 */
async function getAllUsers(includeInactive = true) {
    const where = includeInactive
        ? {}
        : { active: true };
    return prisma_1.prisma.user.findMany({
        where,
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            confirmedAt: true,
            createdAt: true,
            updatedAt: true,
            password: false, // Explicitly exclude password
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}
/**
 * Counts total number of users
 * @param activeOnly - Whether to count only active users (default: false)
 * @returns Total number of users
 */
async function countUsers(activeOnly = false) {
    const where = activeOnly ? { active: true } : {};
    return prisma_1.prisma.user.count({ where });
}
/**
 * Checks if a user exists by email
 * @param email - Email address to check
 * @returns True if user exists
 */
async function userExistsByEmail(email) {
    const count = await prisma_1.prisma.user.count({
        where: { email },
    });
    return count > 0;
}
/**
 * Checks if a user exists by username
 * @param name - Username to check
 * @returns True if user exists
 */
async function userExistsByName(name) {
    const count = await prisma_1.prisma.user.count({
        where: { name },
    });
    return count > 0;
}
