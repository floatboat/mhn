"use strict";
/**
 * HPFeeds Type Definitions and JSON Schemas
 *
 * This file contains TypeScript interfaces and JSON schemas for HPFeeds-related operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCredentialsSchema = exports.getCredentialsByUuidSchema = exports.listCredentialsSchema = exports.hpfeedsStatusSchema = exports.generateCredentialsSchema = void 0;
/**
 * JSON Schema for generating HPFeeds credentials
 * POST /api/hpfeeds/credentials
 */
exports.generateCredentialsSchema = {
    body: {
        type: 'object',
        required: ['sensorUuid', 'honeypotType'],
        properties: {
            sensorUuid: {
                type: 'string',
                pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
                description: 'UUID v1 of the sensor',
            },
            honeypotType: {
                type: 'string',
                enum: [
                    'dionaea',
                    'cowrie',
                    'conpot',
                    'glastopf',
                    'kippo',
                    'wordpot',
                    'shockpot',
                    'p0f',
                ],
                description: 'Type of honeypot',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                uuid: { type: 'string' },
                secret: { type: 'string' },
                channel: { type: 'string' },
                brokerHost: { type: 'string' },
                brokerPort: { type: 'number' },
            },
        },
    },
};
/**
 * JSON Schema for HPFeeds status endpoint
 * GET /api/hpfeeds/status
 */
exports.hpfeedsStatusSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                connected: { type: 'boolean' },
                brokerHost: { type: 'string' },
                brokerPort: { type: 'number' },
                registeredSensors: { type: 'number' },
                lastUpdate: { type: 'string', format: 'date-time' },
            },
        },
    },
};
/**
 * JSON Schema for listing all HPFeeds credentials
 * GET /api/hpfeeds/credentials
 */
exports.listCredentialsSchema = {
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    uuid: { type: 'string' },
                    secret: { type: 'string' },
                    channel: { type: 'string' },
                },
            },
        },
    },
};
/**
 * JSON Schema for getting credentials by sensor UUID
 * GET /api/hpfeeds/credentials/:uuid
 */
exports.getCredentialsByUuidSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
                description: 'Sensor UUID v1',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                uuid: { type: 'string' },
                secret: { type: 'string' },
                channel: { type: 'string' },
                brokerHost: { type: 'string' },
                brokerPort: { type: 'number' },
            },
        },
    },
};
/**
 * JSON Schema for deleting credentials
 * DELETE /api/hpfeeds/credentials/:uuid
 */
exports.deleteCredentialsSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
                description: 'Sensor UUID v1',
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
