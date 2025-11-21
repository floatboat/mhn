import * as crypto from 'crypto';

/**
 * Generates a random hexadecimal string of specified length
 * @param length - Desired length of the output string (in characters)
 * @returns Random hexadecimal string
 * @example generateRandomHex(40) // Returns 40-char hex string like '7f3a2b1c...'
 */
export function generateRandomHex(length: number): string {
  const bytes = Math.ceil(length / 2);
  return crypto.randomBytes(bytes).toString('hex').slice(0, length);
}

/**
 * Generates a UUID without dashes (32 characters)
 * Used for API keys to match legacy Python implementation
 * @returns UUID string without dashes (32 chars)
 * @example generateApiKeyToken() // Returns 'a1b2c3d4e5f6789012345678abcdef01'
 */
export function generateApiKeyToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generates a secure password reset token (40 characters)
 * Used for password reset flow
 * @returns Random hexadecimal token (40 chars)
 * @example generateResetToken() // Returns '7f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8'
 */
export function generateResetToken(): string {
  return generateRandomHex(40);
}

/**
 * Generates an API key (UUID without dashes, 32 characters)
 * Alias for generateApiKeyToken for backward compatibility
 * @returns UUID string without dashes (32 chars)
 * @example generateApiKey() // Returns 'a1b2c3d4e5f6789012345678abcdef01'
 */
export function generateApiKey(): string {
  return generateApiKeyToken();
}

/**
 * Calculates token expiration time from now
 * @param hours - Number of hours until expiration (default: 24)
 * @returns Date object representing expiration time
 * @example getTokenExpiry(24) // Returns Date 24 hours from now
 */
export function getTokenExpiry(hours: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}
