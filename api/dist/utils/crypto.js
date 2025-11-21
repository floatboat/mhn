"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomHex = generateRandomHex;
exports.generateApiKeyToken = generateApiKeyToken;
exports.generateResetToken = generateResetToken;
exports.generateApiKey = generateApiKey;
exports.getTokenExpiry = getTokenExpiry;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a random hexadecimal string of specified length
 * @param length - Desired length of the output string (in characters)
 * @returns Random hexadecimal string
 * @example generateRandomHex(40) // Returns 40-char hex string like '7f3a2b1c...'
 */
function generateRandomHex(length) {
    const bytes = Math.ceil(length / 2);
    return crypto_1.default.randomBytes(bytes).toString('hex').slice(0, length);
}
/**
 * Generates a UUID without dashes (32 characters)
 * Used for API keys to match legacy Python implementation
 * @returns UUID string without dashes (32 chars)
 * @example generateApiKeyToken() // Returns 'a1b2c3d4e5f6789012345678abcdef01'
 */
function generateApiKeyToken() {
    return crypto_1.default.randomUUID().replace(/-/g, '');
}
/**
 * Generates a secure password reset token (40 characters)
 * Used for password reset flow
 * @returns Random hexadecimal token (40 chars)
 * @example generateResetToken() // Returns '7f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8'
 */
function generateResetToken() {
    return generateRandomHex(40);
}
/**
 * Generates an API key (UUID without dashes, 32 characters)
 * Alias for generateApiKeyToken for backward compatibility
 * @returns UUID string without dashes (32 chars)
 * @example generateApiKey() // Returns 'a1b2c3d4e5f6789012345678abcdef01'
 */
function generateApiKey() {
    return generateApiKeyToken();
}
/**
 * Calculates token expiration time from now
 * @param hours - Number of hours until expiration (default: 24)
 * @returns Date object representing expiration time
 * @example getTokenExpiry(24) // Returns Date 24 hours from now
 */
function getTokenExpiry(hours = 24) {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    return expiry;
}
