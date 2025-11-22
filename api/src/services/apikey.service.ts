import { prisma } from '../lib/prisma';
import { generateApiKeyToken } from '../utils/crypto';

/**
 * Custom error for API key not found
 */
export class ApiKeyNotFoundError extends Error {
  constructor(message: string = 'API key not found') {
    super(message);
    this.name = 'ApiKeyNotFoundError';
  }
}

/**
 * Custom error for invalid API key
 */
export class InvalidApiKeyError extends Error {
  constructor(message: string = 'Invalid API key') {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

/**
 * Custom error for unauthorized API key operations
 */
export class UnauthorizedApiKeyError extends Error {
  constructor(message: string = 'Not authorized to perform this operation') {
    super(message);
    this.name = 'UnauthorizedApiKeyError';
  }
}

/**
 * API key response without sensitive data
 */
export interface ApiKeyResponse {
  id: number;
  apiKey: string;
  userId: number;
  createdAt: Date;
}

/**
 * User response from API key validation (without password)
 */
export interface UserFromApiKey {
  id: number;
  email: string;
  name: string;
  active: boolean;
}

/**
 * Creates a new API key for a user
 * Generates a UUID without dashes (32 characters) to match legacy implementation
 * @param userId - User ID to create API key for
 * @returns Created API key object
 */
export async function createApiKey(userId: number): Promise<ApiKeyResponse> {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate unique API key token
  const apiKey = generateApiKeyToken();

  // Create API key in database
  const createdApiKey = await prisma.apiKey.create({
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
export async function validateApiKey(apiKey: string): Promise<UserFromApiKey> {
  // Find API key with associated user
  const apiKeyRecord = await prisma.apiKey.findUnique({
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
export async function deleteApiKey(
  apiKeyId: number,
  userId: number,
): Promise<boolean> {
  // Find API key
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
  });

  if (!apiKey) {
    throw new ApiKeyNotFoundError();
  }

  // Verify ownership
  if (apiKey.userId !== userId) {
    throw new UnauthorizedApiKeyError(
      'You are not authorized to delete this API key',
    );
  }

  // Delete API key
  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  });

  return true;
}

/**
 * Gets all API keys for a user
 * @param userId - User ID to get API keys for
 * @returns Array of API key objects
 */
export async function getUserApiKeys(
  userId: number,
): Promise<ApiKeyResponse[]> {
  const apiKeys = await prisma.apiKey.findMany({
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
export async function userHasApiKey(userId: number): Promise<boolean> {
  const count = await prisma.apiKey.count({
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
export async function deleteAllUserApiKeys(userId: number): Promise<number> {
  const result = await prisma.apiKey.deleteMany({
    where: { userId },
  });

  return result.count;
}
