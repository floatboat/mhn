"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthorizedApiKeyError = exports.InvalidApiKeyError = exports.ApiKeyNotFoundError = void 0;
exports.createApiKey = createApiKey;
exports.validateApiKey = validateApiKey;
exports.deleteApiKey = deleteApiKey;
exports.getUserApiKeys = getUserApiKeys;
exports.userHasApiKey = userHasApiKey;
exports.deleteAllUserApiKeys = deleteAllUserApiKeys;
const prisma_1 = require("../lib/prisma");
const crypto_1 = require("../utils/crypto");
/**
 * Custom error for API key not found
 */
class ApiKeyNotFoundError extends Error {
    constructor(message = 'API key not found') {
        super(message);
        this.name = 'ApiKeyNotFoundError';
    }
}
exports.ApiKeyNotFoundError = ApiKeyNotFoundError;
/**
 * Custom error for invalid API key
 */
class InvalidApiKeyError extends Error {
    constructor(message = 'Invalid API key') {
        super(message);
        this.name = 'InvalidApiKeyError';
    }
}
exports.InvalidApiKeyError = InvalidApiKeyError;
/**
 * Custom error for unauthorized API key operations
 */
class UnauthorizedApiKeyError extends Error {
    constructor(message = 'Not authorized to perform this operation') {
        super(message);
        this.name = 'UnauthorizedApiKeyError';
    }
}
exports.UnauthorizedApiKeyError = UnauthorizedApiKeyError;
/**
 * Creates a new API key for a user
 * Generates a UUID without dashes (32 characters) to match legacy implementation
 * @param userId - User ID to create API key for
 * @returns Created API key object
 */
async function createApiKey(userId) {
    // Verify user exists
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        throw new Error('User not found');
    }
    // Generate unique API key token
    const apiKey = (0, crypto_1.generateApiKeyToken)();
    // Create API key in database
    const createdApiKey = await prisma_1.prisma.apiKey.create({
        data: {
            apiKey,
            userId,
        },
    });
    return {
        id: createdApiKey.id,
        apiKey: createdApiKey.apiKey,
        userId: createdApiKey.userId,
        createdAt: createdApiKey.createdAt,
    };
}
/**
 * Validates an API key and returns the associated user
 * @param apiKey - API key string to validate
 * @returns User object if API key is valid
 * @throws InvalidApiKeyError if API key is invalid or user is inactive
 */
async function validateApiKey(apiKey) {
    // Find API key with associated user
    const apiKeyRecord = await prisma_1.prisma.apiKey.findUnique({
        where: { apiKey },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    active: true,
                    password: false, // Explicitly exclude password
                },
            },
        },
    });
    // Check if API key exists
    if (!apiKeyRecord) {
        throw new InvalidApiKeyError('API key not found');
    }
    // Check if user is active
    if (!apiKeyRecord.user.active) {
        throw new InvalidApiKeyError('User account is inactive');
    }
    return apiKeyRecord.user;
}
/**
 * Deletes an API key
 * Ensures the user requesting deletion owns the API key
 * @param apiKeyId - API key ID to delete
 * @param userId - User ID requesting deletion
 * @returns True if deletion was successful
 * @throws ApiKeyNotFoundError if API key doesn't exist
 * @throws UnauthorizedApiKeyError if user doesn't own the API key
 */
async function deleteApiKey(apiKeyId, userId) {
    // Find API key
    const apiKey = await prisma_1.prisma.apiKey.findUnique({
        where: { id: apiKeyId },
    });
    if (!apiKey) {
        throw new ApiKeyNotFoundError();
    }
    // Verify ownership
    if (apiKey.userId !== userId) {
        throw new UnauthorizedApiKeyError('You are not authorized to delete this API key');
    }
    // Delete API key
    await prisma_1.prisma.apiKey.delete({
        where: { id: apiKeyId },
    });
    return true;
}
/**
 * Gets all API keys for a user
 * @param userId - User ID to get API keys for
 * @returns Array of API key objects
 */
async function getUserApiKeys(userId) {
    const apiKeys = await prisma_1.prisma.apiKey.findMany({
        where: { userId },
        select: {
            id: true,
            apiKey: true,
            userId: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return apiKeys;
}
/**
 * Checks if a user has any API keys
 * @param userId - User ID to check
 * @returns True if user has at least one API key
 */
async function userHasApiKey(userId) {
    const count = await prisma_1.prisma.apiKey.count({
        where: { userId },
    });
    return count > 0;
}
/**
 * Deletes all API keys for a user
 * Useful when deleting a user account
 * @param userId - User ID to delete all API keys for
 * @returns Number of API keys deleted
 */
async function deleteAllUserApiKeys(userId) {
    const result = await prisma_1.prisma.apiKey.deleteMany({
        where: { userId },
    });
    return result.count;
}
