"use strict";
// src/types/apikey.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApiKeySchema = exports.createApiKeySchema = exports.listApiKeysSchema = void 0;
// JSON Schemas for request validation
/**
 * Schema for listing API keys (admin only)
 */
exports.listApiKeysSchema = {
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    apiKey: { type: 'string' },
                    createdAt: { type: 'string' },
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                        },
                    },
                },
            },
        },
    },
};
/**
 * Schema for creating API key
 */
exports.createApiKeySchema = {
    response: {
        201: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                apiKey: { type: 'string' },
                createdAt: { type: 'string' },
                userId: { type: 'number' },
            },
        },
    },
};
/**
 * Schema for deleting API key
 */
exports.deleteApiKeySchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'API Key ID',
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
