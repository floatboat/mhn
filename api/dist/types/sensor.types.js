"use strict";
// src/types/sensor.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensorConnectSchema = exports.deleteSensorSchema = exports.updateSensorSchema = exports.getSensorSchema = exports.getSensorsSchema = exports.registerSensorSchema = void 0;
// JSON Schemas for request validation
/**
 * Schema for sensor registration
 * POST /api/sensor
 */
exports.registerSensorSchema = {
    body: {
        type: 'object',
        required: ['name', 'hostname', 'honeypot'],
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
                description: 'Sensor display name',
            },
            hostname: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
                description: 'Sensor hostname',
            },
            honeypot: {
                type: 'string',
                enum: [
                    'dionaea',
                    'cowrie',
                    'conpot',
                    'kippo',
                    'glastopf',
                    'wordpot',
                    'shockpot',
                    'p0f',
                ],
                description: 'Type of honeypot software',
            },
        },
    },
    querystring: {
        type: 'object',
        required: ['deploy_key'],
        properties: {
            deploy_key: {
                type: 'string',
                description: 'Deploy key for sensor registration',
            },
        },
    },
    response: {
        201: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                uuid: { type: 'string' },
                name: { type: 'string' },
                hostname: { type: 'string' },
                ip: { type: 'string' },
                identifier: { type: 'string' },
                honeypot: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for listing sensors
 * GET /api/sensor
 */
exports.getSensorsSchema = {
    querystring: {
        type: 'object',
        properties: {
            api_key: {
                type: 'string',
                description: 'API key for authentication',
            },
            honeypot: {
                type: 'string',
                enum: [
                    'dionaea',
                    'cowrie',
                    'conpot',
                    'kippo',
                    'glastopf',
                    'wordpot',
                    'shockpot',
                    'p0f',
                ],
                description: 'Filter by honeypot type',
            },
            startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Filter sensors created after this date (ISO 8601)',
            },
            endDate: {
                type: 'string',
                format: 'date-time',
                description: 'Filter sensors created before this date (ISO 8601)',
            },
        },
    },
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    uuid: { type: 'string' },
                    name: { type: 'string' },
                    hostname: { type: 'string' },
                    ip: { type: 'string' },
                    identifier: { type: 'string' },
                    honeypot: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                },
            },
        },
    },
};
/**
 * Schema for getting single sensor
 * GET /api/sensor/:uuid
 */
exports.getSensorSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                description: 'Sensor UUID',
            },
        },
    },
    querystring: {
        type: 'object',
        required: ['api_key'],
        properties: {
            api_key: {
                type: 'string',
                description: 'API key for authentication',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                uuid: { type: 'string' },
                name: { type: 'string' },
                hostname: { type: 'string' },
                ip: { type: 'string' },
                identifier: { type: 'string' },
                honeypot: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for updating sensor
 * PUT /api/sensor/:uuid
 */
exports.updateSensorSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                description: 'Sensor UUID',
            },
        },
    },
    body: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
                description: 'Sensor display name',
            },
            hostname: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
                description: 'Sensor hostname',
            },
        },
    },
    querystring: {
        type: 'object',
        required: ['api_key'],
        properties: {
            api_key: {
                type: 'string',
                description: 'API key for authentication',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'number' },
                uuid: { type: 'string' },
                name: { type: 'string' },
                hostname: { type: 'string' },
                ip: { type: 'string' },
                identifier: { type: 'string' },
                honeypot: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
            },
        },
    },
};
/**
 * Schema for deleting sensor
 * DELETE /api/sensor/:uuid
 */
exports.deleteSensorSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                description: 'Sensor UUID',
            },
        },
    },
    querystring: {
        type: 'object',
        required: ['api_key'],
        properties: {
            api_key: {
                type: 'string',
                description: 'API key for authentication',
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
 * Schema for sensor check-in
 * POST /api/sensor/:uuid/connect
 */
exports.sensorConnectSchema = {
    params: {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                description: 'Sensor UUID',
            },
        },
    },
    querystring: {
        type: 'object',
        required: ['deploy_key'],
        properties: {
            deploy_key: {
                type: 'string',
                description: 'Deploy key for sensor authentication',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                ip: { type: 'string' },
            },
        },
    },
};
