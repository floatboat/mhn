"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidResetTokenError = exports.UserNotFoundError = void 0;
exports.requestReset = requestReset;
exports.validateResetToken = validateResetToken;
exports.resetPassword = resetPassword;
exports.getUserActiveResetTokens = getUserActiveResetTokens;
exports.revokeAllUserResetTokens = revokeAllUserResetTokens;
exports.cleanupExpiredTokens = cleanupExpiredTokens;
exports.deleteOldResetTokens = deleteOldResetTokens;
exports.userHasActiveResetToken = userHasActiveResetToken;
const prisma_1 = require("../lib/prisma");
const crypto_1 = require("../utils/crypto");
const config_1 = require("../lib/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Salt rounds for bcrypt password hashing
 */
const SALT_ROUNDS = 10;
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
/**
 * Custom error for invalid or expired reset token
 */
class InvalidResetTokenError extends Error {
    constructor(message = 'Invalid or expired reset token') {
        super(message);
        this.name = 'InvalidResetTokenError';
    }
}
exports.InvalidResetTokenError = InvalidResetTokenError;
/**
 * Requests a password reset for a user
 * Creates a reset token that expires after configured hours
 * @param email - User's email address
 * @returns Reset token object with hashStr (send this in email)
 * @throws UserNotFoundError if user doesn't exist
 */
async function requestReset(email) {
    // Find user by email
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (!user) {
        throw new UserNotFoundError(`User with email '${email}' not found`);
    }
    // Deactivate any existing active reset tokens for this user
    await prisma_1.prisma.passwdReset.updateMany({
        where: {
            userId: user.id,
            active: true,
        },
        data: {
            active: false,
        },
    });
    // Generate reset token
    const hashStr = (0, crypto_1.generateResetToken)();
    const expiresAt = (0, crypto_1.getTokenExpiry)(config_1.config.resetTokenExpiryHours);
    // Create reset token record
    const resetToken = await prisma_1.prisma.passwdReset.create({
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
async function validateResetToken(token) {
    // Find reset token
    const resetToken = await prisma_1.prisma.passwdReset.findUnique({
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
        await prisma_1.prisma.passwdReset.update({
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
async function resetPassword(token, newPassword) {
    // Validate reset token
    const resetToken = await validateResetToken(token);
    // Hash new password
    const hashedPassword = await bcrypt_1.default.hash(newPassword, SALT_ROUNDS);
    // Update user's password
    await prisma_1.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
    });
    // Deactivate the reset token
    await prisma_1.prisma.passwdReset.update({
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
async function getUserActiveResetTokens(userId) {
    return prisma_1.prisma.passwdReset.findMany({
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
async function revokeAllUserResetTokens(userId) {
    const result = await prisma_1.prisma.passwdReset.updateMany({
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
async function cleanupExpiredTokens() {
    const result = await prisma_1.prisma.passwdReset.updateMany({
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
async function deleteOldResetTokens(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const result = await prisma_1.prisma.passwdReset.deleteMany({
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
async function userHasActiveResetToken(userId) {
    const count = await prisma_1.prisma.passwdReset.count({
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
