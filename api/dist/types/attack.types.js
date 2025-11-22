"use strict";
// src/types/attack.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttackDetailSchema = exports.searchAttacksByIpSchema = exports.getAttacksBySensorSchema = exports.getGeoStatsSchema = exports.getTopAttackersSchema = exports.getAttackStatsSchema = exports.getAttacksSchema = void 0;
// JSON Schemas for request/response validation
/**
 * Schema for GET /api/attack
 * List attacks with filtering and pagination
 */
exports.getAttacksSchema = {
    querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
            startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Start of date range (ISO 8601)',
            },
            endDate: {
                type: 'string',
                format: 'date-time',
                description: 'End of date range (ISO 8601)',
            },
            sensorId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Filter by sensor ID',
            },
            sourceIp: {
                type: 'string',
                description: 'Filter by source IP address',
            },
            protocol: {
                type: 'string',
                enum: [
                    'TCP',
                    'UDP',
                    'HTTP',
                    'HTTPS',
                    'SSH',
                    'FTP',
                    'SMTP',
                    'DNS',
                    'ICMP',
                    'TELNET',
                    'RDP',
                    'SMB',
                    'OTHER',
                ],
                description: 'Filter by protocol',
            },
            limit: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Results per page (default 20, max 1000)',
            },
            offset: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Pagination offset (default 0)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                attacks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            sourceIp: { type: 'string' },
                            protocol: { type: 'string' },
                            port: { type: ['number', 'null'] },
                            timestamp: { type: 'string' },
                            sensor: {
                                type: ['object', 'null'],
                                properties: {
                                    uuid: { type: 'string' },
                                    name: { type: 'string' },
                                    honeypot: { type: 'string' },
                                },
                            },
                            location: {
                                type: ['object', 'null'],
                                properties: {
                                    country: { type: ['string', 'null'] },
                                    city: { type: ['string', 'null'] },
                                    latitude: { type: ['number', 'null'] },
                                    longitude: { type: ['number', 'null'] },
                                },
                            },
                        },
                    },
                },
                total: { type: 'number' },
                filtered: { type: 'number' },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/stats
 * Get attack statistics
 */
exports.getAttackStatsSchema = {
    querystring: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional start date for filtering (ISO 8601)',
            },
            endDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional end date for filtering (ISO 8601)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                totalAttacks: { type: 'number' },
                uniqueAttackers: { type: 'number' },
                topProtocols: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            protocol: { type: 'string' },
                            count: { type: 'number' },
                        },
                    },
                },
                topCountries: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            country: { type: 'string' },
                            count: { type: 'number' },
                        },
                    },
                },
                attacksByHoneypot: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            honeypot: { type: 'string' },
                            count: { type: 'number' },
                        },
                    },
                },
                attacksBySensor: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            sensorName: { type: 'string' },
                            count: { type: 'number' },
                        },
                    },
                },
                timeRange: {
                    type: 'object',
                    properties: {
                        start: { type: 'string' },
                        end: { type: 'string' },
                    },
                },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/top-attackers
 * Get top attacker leaderboard
 */
exports.getTopAttackersSchema = {
    querystring: {
        type: 'object',
        properties: {
            limit: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Number of top attackers to return (default 10, max 100)',
            },
            startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional start date for filtering (ISO 8601)',
            },
            endDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional end date for filtering (ISO 8601)',
            },
        },
    },
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    sourceIp: { type: 'string' },
                    country: { type: 'string' },
                    city: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    attackCount: { type: 'number' },
                    protocols: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    sensorsHit: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/geo
 * Get geographic statistics for heatmap
 */
exports.getGeoStatsSchema = {
    querystring: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional start date for filtering (ISO 8601)',
            },
            endDate: {
                type: 'string',
                format: 'date-time',
                description: 'Optional end date for filtering (ISO 8601)',
            },
        },
    },
    response: {
        200: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    country: { type: 'string' },
                    country_code: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    attackCount: { type: 'number' },
                    uniqueIps: { type: 'number' },
                },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/sensor/:sensorId
 * Get attacks for specific sensor
 */
exports.getAttacksBySensorSchema = {
    params: {
        type: 'object',
        required: ['sensorId'],
        properties: {
            sensorId: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Sensor ID',
            },
        },
    },
    querystring: {
        type: 'object',
        properties: {
            limit: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Results per page (default 20, max 1000)',
            },
            offset: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Pagination offset (default 0)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                attacks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            sourceIp: { type: 'string' },
                            protocol: { type: 'string' },
                            port: { type: ['number', 'null'] },
                            timestamp: { type: 'string' },
                            sensorId: { type: 'number' },
                            mongoId: { type: ['string', 'null'] },
                            location: {
                                type: ['object', 'null'],
                                properties: {
                                    country: { type: ['string', 'null'] },
                                    city: { type: ['string', 'null'] },
                                    latitude: { type: ['number', 'null'] },
                                    longitude: { type: ['number', 'null'] },
                                },
                            },
                        },
                    },
                },
                total: { type: 'number' },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/search
 * Search attacks by source IP
 */
exports.searchAttacksByIpSchema = {
    querystring: {
        type: 'object',
        required: ['ip'],
        properties: {
            ip: {
                type: 'string',
                description: 'Source IP address to search for (required)',
            },
            limit: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Maximum results to return (default 50, max 1000)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                attacks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            sourceIp: { type: 'string' },
                            protocol: { type: 'string' },
                            port: { type: ['number', 'null'] },
                            timestamp: { type: 'string' },
                            sensorId: { type: 'number' },
                            mongoId: { type: ['string', 'null'] },
                            location: {
                                type: ['object', 'null'],
                                properties: {
                                    country: { type: ['string', 'null'] },
                                    city: { type: ['string', 'null'] },
                                    latitude: { type: ['number', 'null'] },
                                    longitude: { type: ['number', 'null'] },
                                },
                            },
                        },
                    },
                },
                total: { type: 'number' },
            },
        },
    },
};
/**
 * Schema for GET /api/attack/:id
 * Get detailed attack payload from MongoDB
 */
exports.getAttackDetailSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {
                type: 'string',
                pattern: '^[0-9a-f]{24}$',
                description: 'MongoDB ObjectId (24 hex characters)',
            },
        },
    },
    response: {
        200: {
            type: 'object',
            description: 'Attack event document from MongoDB',
        },
    },
};
