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
exports.TokenBlacklistedError = exports.InactiveUserError = exports.InvalidCredentialsError = void 0;
exports.login = login;
exports.logout = logout;
exports.refreshAccessToken = refreshAccessToken;
exports.isTokenBlacklisted = isTokenBlacklisted;
exports.clearTokenBlacklist = clearTokenBlacklist;
exports.getBlacklistSize = getBlacklistSize;
const prisma_1 = require("../lib/prisma");
const tokens_1 = require("../lib/tokens");
const user_service_1 = require("./user.service");
/**
 * In-memory blacklist for revoked refresh tokens
 * In production, this should be moved to Redis for scalability
 */
const tokenBlacklist = new Set();
/**
 * Custom error for invalid credentials
 */
class InvalidCredentialsError extends Error {
    constructor(message = 'Invalid email or password') {
        super(message);
        this.name = 'InvalidCredentialsError';
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
/**
 * Custom error for inactive user accounts
 */
class InactiveUserError extends Error {
    constructor(message = 'User account is inactive') {
        super(message);
        this.name = 'InactiveUserError';
    }
}
exports.InactiveUserError = InactiveUserError;
/**
 * Custom error for blacklisted tokens
 */
class TokenBlacklistedError extends Error {
    constructor(message = 'Token has been revoked') {
        super(message);
        this.name = 'TokenBlacklistedError';
    }
}
exports.TokenBlacklistedError = TokenBlacklistedError;
/**
 * Authenticates a user with email and password
 * @param email - User's email address
 * @param password - User's plain text password
 * @returns Login response with user info and JWT tokens
 * @throws InvalidCredentialsError if credentials are invalid
 * @throws InactiveUserError if user account is inactive
 */
async function login(email, password) {
    // Find user by email
    const user = await prisma_1.prisma.user.findUnique({
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
    if (!user || !(await (0, user_service_1.verifyPassword)(password, user.password))) {
        throw new InvalidCredentialsError();
    }
    // Check if user account is active
    if (!user.active) {
        throw new InactiveUserError();
    }
    // Generate JWT tokens
    const tokens = (0, tokens_1.generateTokenPair)(user.id, user.email);
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
async function logout(refreshToken) {
    // Verify token is valid before blacklisting
    (0, tokens_1.verifyToken)(refreshToken);
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
async function refreshAccessToken(refreshToken) {
    // Check if token is blacklisted
    if (tokenBlacklist.has(refreshToken)) {
        throw new TokenBlacklistedError();
    }
    // Verify and decode refresh token
    const decoded = (0, tokens_1.verifyToken)(refreshToken);
    // Verify token type
    if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type - expected refresh token');
    }
    // Verify user still exists and is active
    const user = await prisma_1.prisma.user.findUnique({
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
    const { generateAccessToken } = await Promise.resolve().then(() => __importStar(require('../lib/tokens')));
    return generateAccessToken(user.id, user.email);
}
/**
 * Checks if a refresh token is blacklisted
 * @param refreshToken - Refresh token to check
 * @returns True if token is blacklisted
 */
function isTokenBlacklisted(refreshToken) {
    return tokenBlacklist.has(refreshToken);
}
/**
 * Clears the entire token blacklist
 * Use with caution - primarily for testing
 */
function clearTokenBlacklist() {
    tokenBlacklist.clear();
}
/**
 * Gets the size of the token blacklist
 * Useful for monitoring and debugging
 * @returns Number of blacklisted tokens
 */
function getBlacklistSize() {
    return tokenBlacklist.size;
}
