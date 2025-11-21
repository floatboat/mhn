"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTokenError = exports.TokenExpiredError = exports.TokenError = void 0;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generateTokenPair = generateTokenPair;
exports.verifyToken = verifyToken;
exports.decodeToken = decodeToken;
exports.isTokenExpired = isTokenExpired;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
/**
 * Custom error for token validation failures
 */
class TokenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TokenError';
    }
}
exports.TokenError = TokenError;
/**
 * Custom error for expired tokens
 */
class TokenExpiredError extends TokenError {
    constructor(message = 'Token has expired') {
        super(message);
        this.name = 'TokenExpiredError';
    }
}
exports.TokenExpiredError = TokenExpiredError;
/**
 * Custom error for invalid tokens
 */
class InvalidTokenError extends TokenError {
    constructor(message = 'Invalid token') {
        super(message);
        this.name = 'InvalidTokenError';
    }
}
exports.InvalidTokenError = InvalidTokenError;
/**
 * Generates a JWT access token (short-lived)
 * @param userId - User's ID
 * @param email - User's email
 * @returns JWT access token string
 */
function generateAccessToken(userId, email) {
    const payload = {
        userId,
        email,
        type: 'access',
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.accessExpiry,
    });
}
/**
 * Generates a JWT refresh token (long-lived)
 * @param userId - User's ID
 * @param email - User's email
 * @returns JWT refresh token string
 */
function generateRefreshToken(userId, email) {
    const payload = {
        userId,
        email,
        type: 'refresh',
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.refreshExpiry,
    });
}
/**
 * Generates both access and refresh tokens
 * @param userId - User's ID
 * @param email - User's email
 * @returns Object containing both tokens
 */
function generateTokenPair(userId, email) {
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
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new TokenExpiredError('Token has expired');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
function decodeToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
}
/**
 * Checks if a token has expired without verifying signature
 * @param token - JWT token string
 * @returns True if token is expired
 */
function isTokenExpired(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return true;
    }
    return Date.now() >= decoded.exp * 1000;
}
