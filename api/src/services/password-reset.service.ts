import { prisma } from '../lib/prisma';
import { generateResetToken, getTokenExpiry } from '../utils/crypto';
import { config } from '../lib/config';
import bcrypt from 'bcrypt';

/**
 * Salt rounds for bcrypt password hashing
 */
const SALT_ROUNDS = 10;

/**
 * Custom error for user not found
 */
export class UserNotFoundError extends Error {
  constructor(message: string = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Custom error for invalid or expired reset token
 */
export class InvalidResetTokenError extends Error {
  constructor(message: string = 'Invalid or expired reset token') {
    super(message);
    this.name = 'InvalidResetTokenError';
  }
}

/**
 * Password reset token response
 */
export interface ResetTokenResponse {
  id: number;
  hashStr: string;
  userId: number;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Requests a password reset for a user
 * Creates a reset token that expires after configured hours
 * @param email - User's email address
 * @returns Reset token object with hashStr (send this in email)
 * @throws UserNotFoundError if user doesn't exist
 */
export async function requestReset(email: string): Promise<ResetTokenResponse> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UserNotFoundError(`User with email '${email}' not found`);
  }

  // Deactivate any existing active reset tokens for this user
  await prisma.passwdReset.updateMany({
    where: {
      userId: user.id,
      active: true,
    },
    data: {
      active: false,
    },
  });

  // Generate reset token
  const hashStr = generateResetToken();
  const expiresAt = getTokenExpiry(config.resetTokenExpiryHours);

  // Create reset token record
  const resetToken = await prisma.passwdReset.create({
    data: {
      hashStr,
      userId: user.id,
      expiresAt,
      active: true,
    },
  });

  return resetToken;
}

/**
 * Validates a reset token
 * Checks if token exists, is active, and hasn't expired
 * @param token - Reset token string (hashStr)
 * @returns Reset token object if valid
 * @throws InvalidResetTokenError if token is invalid or expired
 */
export async function validateResetToken(
  token: string,
): Promise<ResetTokenResponse> {
  // Find reset token
  const resetToken = await prisma.passwdReset.findUnique({
    where: { hashStr: token },
  });

  if (!resetToken) {
    throw new InvalidResetTokenError('Reset token not found');
  }

  // Check if token is active
  if (!resetToken.active) {
    throw new InvalidResetTokenError('Reset token has been used or revoked');
  }

  // Check if token has expired
  if (resetToken.expiresAt < new Date()) {
    // Deactivate expired token
    await prisma.passwdReset.update({
      where: { id: resetToken.id },
      data: { active: false },
    });

    throw new InvalidResetTokenError('Reset token has expired');
  }

  return resetToken;
}

/**
 * Resets a user's password using a valid reset token
 * @param token - Reset token string (hashStr)
 * @param newPassword - New password (plain text, will be hashed)
 * @returns True if password was reset successfully
 * @throws InvalidResetTokenError if token is invalid or expired
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<boolean> {
  // Validate reset token
  const resetToken = await validateResetToken(token);

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update user's password
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  });

  // Deactivate the reset token
  await prisma.passwdReset.update({
    where: { id: resetToken.id },
    data: { active: false },
  });

  return true;
}

/**
 * Gets all active reset tokens for a user
 * @param userId - User ID
 * @returns Array of active reset tokens
 */
export async function getUserActiveResetTokens(
  userId: number,
): Promise<ResetTokenResponse[]> {
  return prisma.passwdReset.findMany({
    where: {
      userId,
      active: true,
      expiresAt: {
        gte: new Date(), // Not expired
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Revokes all active reset tokens for a user
 * Useful when user logs in or changes password through normal flow
 * @param userId - User ID
 * @returns Number of tokens revoked
 */
export async function revokeAllUserResetTokens(userId: number): Promise<number> {
  const result = await prisma.passwdReset.updateMany({
    where: {
      userId,
      active: true,
    },
    data: {
      active: false,
    },
  });

  return result.count;
}

/**
 * Cleans up expired reset tokens from the database
 * Should be run periodically (e.g., daily via cron job)
 * @returns Number of tokens cleaned up
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.passwdReset.updateMany({
    where: {
      active: true,
      expiresAt: {
        lt: new Date(), // Expired
      },
    },
    data: {
      active: false,
    },
  });

  return result.count;
}

/**
 * Deletes old inactive reset tokens from the database
 * Should be run periodically to keep database clean
 * @param daysOld - Delete tokens older than this many days (default: 30)
 * @returns Number of tokens deleted
 */
export async function deleteOldResetTokens(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.passwdReset.deleteMany({
    where: {
      active: false,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Checks if a user has any active reset tokens
 * @param userId - User ID
 * @returns True if user has at least one active, non-expired token
 */
export async function userHasActiveResetToken(userId: number): Promise<boolean> {
  const count = await prisma.passwdReset.count({
    where: {
      userId,
      active: true,
      expiresAt: {
        gte: new Date(),
      },
    },
  });

  return count > 0;
}
