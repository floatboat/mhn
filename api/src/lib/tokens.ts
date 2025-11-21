import * as jwt from 'jsonwebtoken';
import { config } from './config';

/**
 * JWT token payload interface
 */
export interface TokenPayload {
  userId: number;
  email: string;
  type: 'access' | 'refresh';
}

/**
 * Decoded JWT token with standard claims
 */
export interface DecodedToken extends TokenPayload {
  iat: number; // Issued at
  exp: number; // Expiration time
}

/**
 * Custom error for token validation failures
 */
export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

/**
 * Custom error for expired tokens
 */
export class TokenExpiredError extends TokenError {
  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Custom error for invalid tokens
 */
export class InvalidTokenError extends TokenError {
  constructor(message: string = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Generates a JWT access token (short-lived)
 * @param userId - User's ID
 * @param email - User's email
 * @returns JWT access token string
 */
export function generateAccessToken(userId: number, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as any,
  });
}

/**
 * Generates a JWT refresh token (long-lived)
 * @param userId - User's ID
 * @param email - User's email
 * @returns JWT refresh token string
 */
export function generateRefreshToken(userId: number, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry as any,
  });
}

/**
 * Generates both access and refresh tokens
 * @param userId - User's ID
 * @param email - User's email
 * @returns Object containing both tokens
 */
export function generateTokenPair(
  userId: number,
  email: string,
): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(userId, email),
    refreshToken: generateRefreshToken(userId, email),
  };
}

/**
 * Verifies and decodes a JWT token
 * @param token - JWT token string
 * @returns Decoded token payload
 * @throws TokenExpiredError if token has expired
 * @throws InvalidTokenError if token is invalid
 */
export function verifyToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as DecodedToken;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError('Invalid token');
    }
    throw new TokenError('Token verification failed');
  }
}

/**
 * Decodes a JWT token without verifying signature
 * Use only for inspecting token contents, not for authentication
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Checks if a token has expired without verifying signature
 * @param token - JWT token string
 * @returns True if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  return Date.now() >= decoded.exp * 1000;
}
