"use strict";
// src/types/role.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeRoleSchema = exports.assignRoleSchema = exports.getRoleSchema = exports.listRolesSchema = exports.updateRoleSchema = exports.createRoleSchema = void 0;
// JSON Schemas for request validation
/**
 * Schema for creating a role
 */
exports.createRoleSchema = {
    body: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                minLength: 2,
                maxLength: 50,
                pattern: '^[a-z_]+$',
                description: 'Role name (lowercase letters and underscores only)',
            },
            description: {
                type: 'string',
                maxLength: 255,
                description: 'Optional role description',
            },
        },
    },
    response: {
        201: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for updating a role
 */
exports.updateRoleSchema = {
    body: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                maxLength: 255,
                description: 'Role description',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for listing roles
 */
exports.listRolesSchema = {
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    userCount: { type: 'number' },
                },
            },
        },
    },
};
/**
 * Schema for getting a single role
 */
exports.getRoleSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Role ID',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                userCount: { type: 'number' },
            },
        },
    },
};
/**
 * Schema for assigning role to user
 */
exports.assignRoleSchema = {
    params: {
        type: 'object',
        required: ['roleId', 'userId'],
        properties: {
            roleId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Role ID',
            },
            userId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'User ID',
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
 * Schema for removing role from user
 */
exports.removeRoleSchema = {
    params: {
        type: 'object',
        required: ['roleId', 'userId'],
        properties: {
            roleId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Role ID',
            },
            userId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'User ID',
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
