import { prisma } from '../lib/prisma';
import { generateTokenPair, verifyToken, DecodedToken } from '../lib/tokens';
import { verifyPassword } from './user.service';

/**
 * In-memory blacklist for revoked refresh tokens
 * In production, this should be moved to Redis for scalability
 */
const tokenBlacklist = new Set<string>();

/**
 * Custom error for invalid credentials
 */
export class InvalidCredentialsError extends Error {
  constructor(message: string = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Custom error for inactive user accounts
 */
export class InactiveUserError extends Error {
  constructor(message: string = 'User account is inactive') {
    super(message);
    this.name = 'InactiveUserError';
  }
}

/**
 * Custom error for blacklisted tokens
 */
export class TokenBlacklistedError extends Error {
  constructor(message: string = 'Token has been revoked') {
    super(message);
    this.name = 'TokenBlacklistedError';
  }
}

/**
 * Response object for successful login
 */
export interface LoginResponse {
  user: {
    id: number;
    email: string;
    name: string;
    active: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticates a user with email and password
 * @param email - User's email address
 * @param password - User's plain text password
 * @returns Login response with user info and JWT tokens
 * @throws InvalidCredentialsError if credentials are invalid
 * @throws InactiveUserError if user account is inactive
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      active: true,
    },
  });

  // Check if user exists and password is valid
  if (!user || !(await verifyPassword(password, user.password))) {
    throw new InvalidCredentialsError();
  }

  // Check if user account is active
  if (!user.active) {
    throw new InactiveUserError();
  }

  // Generate JWT tokens
  const tokens = generateTokenPair(user.id, user.email);

  // Return user (without password) and tokens
  const { password: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    ...tokens,
  };
}

/**
 * Logs out a user by blacklisting their refresh token
 * @param refreshToken - User's refresh token to invalidate
 * @returns True if logout was successful
 * @throws Error if token is invalid
 */
export async function logout(refreshToken: string): Promise<boolean> {
  // Verify token is valid before blacklisting
  verifyToken(refreshToken);

  // Add to blacklist
  tokenBlacklist.add(refreshToken);

  return true;
}

/**
 * Generates a new access token using a valid refresh token
 * @param refreshToken - User's refresh token
 * @returns New access token
 * @throws TokenBlacklistedError if refresh token has been revoked
 * @throws InvalidCredentialsError if user no longer exists or is inactive
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<string> {
  // Check if token is blacklisted
  if (tokenBlacklist.has(refreshToken)) {
    throw new TokenBlacklistedError();
  }

  // Verify and decode refresh token
  const decoded: DecodedToken = verifyToken(refreshToken);

  // Verify token type
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type - expected refresh token');
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, active: true },
  });

  if (!user) {
    throw new InvalidCredentialsError('User not found');
  }

  if (!user.active) {
    throw new InactiveUserError();
  }

  // Generate new access token
  const { generateAccessToken } = await import('../lib/tokens');
  return generateAccessToken(user.id, user.email);
}

/**
 * Checks if a refresh token is blacklisted
 * @param refreshToken - Refresh token to check
 * @returns True if token is blacklisted
 */
export function isTokenBlacklisted(refreshToken: string): boolean {
  return tokenBlacklist.has(refreshToken);
}

/**
 * Clears the entire token blacklist
 * Use with caution - primarily for testing
 */
export function clearTokenBlacklist(): void {
  tokenBlacklist.clear();
}

/**
 * Gets the size of the token blacklist
 * Useful for monitoring and debugging
 * @returns Number of blacklisted tokens
 */
export function getBlacklistSize(): number {
  return tokenBlacklist.size;
}
