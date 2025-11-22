"use strict";
/**
 * Credential Generation Utilities
 *
 * Provides functions for generating and validating HPFeeds credentials.
 * HPFeeds credentials consist of a sensor UUID and a random 40-character hex secret.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHPFeedsSecret = generateHPFeedsSecret;
exports.isValidHPFeedsSecret = isValidHPFeedsSecret;
exports.isValidUUIDv1 = isValidUUIDv1;
exports.isValidUUID = isValidUUID;
exports.isValidHoneypotType = isValidHoneypotType;
const crypto_1 = require("crypto");
/**
 * Generate random 40-character hex secret for HPFeeds
 *
 * Uses cryptographically secure random bytes (20 bytes = 40 hex chars).
 * This secret is used for sensor authentication with the HPFeeds broker.
 *
 * @returns 40-character hexadecimal string
 *
 * @example
 * ```typescript
 * const secret = generateHPFeedsSecret();
 * // Returns: "a1b2c3d4e5f6789012345678901234567890abcd"
 * ```
 */
function generateHPFeedsSecret() {
    return (0, crypto_1.randomBytes)(20).toString('hex');
}
/**
 * Validate HPFeeds secret format
 *
 * Checks if a string is a valid HPFeeds secret:
 * - Exactly 40 characters
 * - Lowercase hexadecimal (a-f, 0-9)
 *
 * @param secret - Secret string to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidHPFeedsSecret('a1b2c3d4e5f6789012345678901234567890abcd'); // true
 * isValidHPFeedsSecret('invalid'); // false
 * isValidHPFeedsSecret('G123...'); // false (invalid hex char 'G')
 * ```
 */
function isValidHPFeedsSecret(secret) {
    return /^[a-f0-9]{40}$/.test(secret);
}
/**
 * Validate UUID v1 format
 *
 * UUID v1 is time-based and has specific structure:
 * - Format: xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx
 * - First hex digit of 3rd group must be '1' (version)
 * - First hex digit of 4th group must be '8', '9', 'a', or 'b' (variant)
 *
 * @param uuid - UUID string to validate
 * @returns True if valid UUID v1, false otherwise
 *
 * @example
 * ```typescript
 * isValidUUIDv1('550e8400-e29b-11d4-a716-446655440000'); // true (v1)
 * isValidUUIDv1('123e4567-e89b-12d3-a456-426614174000'); // false (v1 but wrong format)
 * isValidUUIDv1('invalid-uuid'); // false
 * ```
 */
function isValidUUIDv1(uuid) {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(uuid);
}
/**
 * Validate general UUID format (any version)
 *
 * Checks if a string matches the general UUID format without version checking.
 *
 * @param uuid - UUID string to validate
 * @returns True if valid UUID format, false otherwise
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-11d4-a716-446655440000'); // true
 * isValidUUID('123e4567-e89b-12d3-a456-426614174000'); // true
 * isValidUUID('invalid-uuid'); // false
 * ```
 */
function isValidUUID(uuid) {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uuid);
}
/**
 * Validate honeypot type
 *
 * Checks if a string is a valid honeypot type supported by MHN.
 *
 * @param honeypotType - Honeypot type string to validate
 * @returns True if valid honeypot type, false otherwise
 *
 * @example
 * ```typescript
 * isValidHoneypotType('dionaea'); // true
 * isValidHoneypotType('cowrie'); // true
 * isValidHoneypotType('invalid'); // false
 * ```
 */
function isValidHoneypotType(honeypotType) {
    const validTypes = [
        'dionaea',
        'cowrie',
        'conpot',
        'glastopf',
        'kippo',
        'wordpot',
        'shockpot',
        'p0f',
    ];
    return validTypes.includes(honeypotType);
}
