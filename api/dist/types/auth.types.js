"use strict";
// src/types/auth.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.userInfoSchema = exports.resetConfirmSchema = exports.resetRequestSchema = exports.refreshSchema = exports.logoutSchema = exports.loginSchema = void 0;
// JSON Schemas for request validation
/**
 * Schema for login request
 */
exports.loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: {
                type: 'string',
                format: 'email',
                description: 'User email address',
            },
            password: {
                type: 'string',
                minLength: 6,
                description: 'User password (minimum 6 characters)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'number' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                        roles: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                },
            },
        },
    },
};
/**
 * Schema for refresh token request
 */
exports.logoutSchema = {
    body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
            refreshToken: {
                type: 'string',
                description: 'Refresh token to invalidate',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        },
    },
};
exports.refreshSchema = {
    body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
            refreshToken: {
                type: 'string',
                description: 'Refresh token obtained from login',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for password reset request
 */
exports.resetRequestSchema = {
    body: {
        type: 'object',
        required: ['email'],
        properties: {
            email: {
                type: 'string',
                format: 'email',
                description: 'Email address of account to reset',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for password reset confirmation
 */
exports.resetConfirmSchema = {
    body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
            token: {
                type: 'string',
                minLength: 40,
                maxLength: 40,
                description: 'Password reset token (40 characters)',
            },
            newPassword: {
                type: 'string',
                minLength: 6,
                description: 'New password (minimum 6 characters)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for user info response
 */
exports.userInfoSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                email: { type: 'string' },
                name: { type: 'string' },
                active: { type: 'boolean' },
                confirmedAt: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                roles: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
        },
    },
};
