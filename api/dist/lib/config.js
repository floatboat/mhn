"use strict";
/**
 * Configuration service for environment variables
 * Validates and provides type-safe access to environment configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.ConfigError = void 0;
exports.validateConfig = validateConfig;
/**
 * Custom error for missing required environment variables
 */
class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}
exports.ConfigError = ConfigError;
/**
 * Requires an environment variable to be set, throws error if missing
 * @param key - Environment variable name
 * @returns Environment variable value
 * @throws ConfigError if environment variable is not set
 */
function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new ConfigError(`Required environment variable ${key} is not set`);
    }
    return value;
}
/**
 * Gets an optional environment variable with a default value
 * @param key - Environment variable name
 * @param defaultValue - Default value if environment variable is not set
 * @returns Environment variable value or default
 */
function getEnv(key, defaultValue) {
    return process.env[key] || defaultValue;
}
/**
 * Application configuration object
 * All required variables are validated on module load
 */
exports.config = {
    // Server
    port: parseInt(getEnv('PORT', '3000')),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    // Database
    databaseUrl: requireEnv('DATABASE_URL'),
    // JWT Authentication
    jwt: {
        secret: requireEnv('JWT_SECRET'),
        accessExpiry: getEnv('JWT_ACCESS_EXPIRY', '15m'), // Access token expiry (short-lived)
        refreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '7d'), // Refresh token expiry (long-lived)
    },
    // Authentication
    deployKey: requireEnv('DEPLOY_KEY'),
    allowPublicRegistration: getEnv('ALLOW_PUBLIC_REGISTRATION', 'false') === 'true',
    // Logging
    logLevel: getEnv('LOG_LEVEL', 'info'),
    // Password Reset
    resetTokenExpiryHours: parseInt(getEnv('RESET_TOKEN_EXPIRY_HOURS', '24')),
    // Environment checks
    isProduction: getEnv('NODE_ENV', 'development') === 'production',
    isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
};
/**
 * Validates that all required configuration is present
 * Call this on application startup to fail fast
 * @throws ConfigError if any required configuration is missing
 */
function validateConfig() {
    // Access all required fields to trigger validation
    exports.config.databaseUrl;
    exports.config.jwt.secret;
    exports.config.deployKey;
    // Production validation checks
    if (exports.config.jwt.secret === 'your-secret-key-change-in-production' &&
        exports.config.isProduction) {
        throw new ConfigError('JWT_SECRET must be changed in production!');
    }
    if (exports.config.deployKey === 'your-deploy-key-change-in-production' &&
        exports.config.isProduction) {
        throw new ConfigError('DEPLOY_KEY must be changed in production!');
    }
}
