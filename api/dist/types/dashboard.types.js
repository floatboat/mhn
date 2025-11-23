"use strict";
/**
 * Type definitions and schemas for Dashboard API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskLevelSchema = exports.AlertsSchema = exports.AlertSchema = exports.AttackTrendsSchema = exports.AttackTrendSchema = exports.SensorHealthSchema = exports.DashboardSummarySchema = exports.ActiveThreatsSchema = exports.ActiveThreatSchema = exports.SensorStatusListSchema = exports.SensorStatusSchema = void 0;
exports.SensorStatusSchema = {
    type: 'object',
    properties: {
        id: { type: 'number', description: 'Sensor ID' },
        uuid: { type: 'string', description: 'Sensor UUID' },
        name: { type: 'string', description: 'Sensor name' },
        honeypot: { type: 'string', description: 'Honeypot type' },
        status: {
            type: 'string',
            enum: ['online', 'offline', 'idle'],
            description: 'Current sensor status',
        },
        lastHeartbeat: { type: ['string', 'null'], format: 'date-time', description: 'Last heartbeat timestamp' },
        activeAttacks24h: { type: 'number', description: 'Attacks in last 24 hours' },
        totalAttacks: { type: 'number', description: 'Total attacks recorded' },
        ipAddress: { type: 'string', description: 'Sensor IP address' },
    },
    required: [
        'id',
        'uuid',
        'name',
        'honeypot',
        'status',
        'activeAttacks24h',
        'totalAttacks',
        'ipAddress',
    ],
};
exports.SensorStatusListSchema = {
    type: 'array',
    items: exports.SensorStatusSchema,
};
exports.ActiveThreatSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', description: 'Threat ID' },
        sourceIp: { type: 'string', description: 'Attacking IP address' },
        targetPort: { type: ['number', 'null'], description: 'Target port' },
        protocol: { type: 'string', description: 'Attack protocol' },
        timestamp: { type: 'string', format: 'date-time', description: 'Attack timestamp' },
        sensorUuid: { type: 'string', description: 'Sensor UUID' },
        sensorName: { type: 'string', description: 'Sensor name' },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Threat severity',
        },
        description: { type: 'string', description: 'Human-readable threat description' },
    },
    required: [
        'id',
        'sourceIp',
        'protocol',
        'timestamp',
        'sensorUuid',
        'sensorName',
        'severity',
        'description',
    ],
};
exports.ActiveThreatsSchema = {
    type: 'array',
    items: exports.ActiveThreatSchema,
};
exports.DashboardSummarySchema = {
    type: 'object',
    properties: {
        totalSensors: { type: 'number', description: 'Total number of sensors' },
        activeSensors: { type: 'number', description: 'Number of online sensors' },
        offlineSensors: { type: 'number', description: 'Number of offline sensors' },
        attacks24h: { type: 'number', description: 'Attacks in last 24 hours' },
        uniqueAttackers24h: { type: 'number', description: 'Unique attacking IPs in 24h' },
        activeThreats: { type: 'number', description: 'Current active threats' },
        topAttackingIp: { type: ['string', 'null'], description: 'Most active attacking IP' },
        topAttackProtocol: { type: ['string', 'null'], description: 'Most common attack protocol' },
    },
    required: [
        'totalSensors',
        'activeSensors',
        'offlineSensors',
        'attacks24h',
        'uniqueAttackers24h',
        'activeThreats',
    ],
};
exports.SensorHealthSchema = {
    type: 'object',
    properties: {
        sensorId: { type: 'number', description: 'Sensor ID' },
        uptime: { type: 'number', minimum: 0, maximum: 100, description: 'Uptime percentage' },
        avgResponseTime: { type: 'number', description: 'Average response time in ms' },
        lastHeartbeat: { type: 'string', format: 'date-time', description: 'Last heartbeat timestamp' },
        isHealthy: { type: 'boolean', description: 'Is sensor healthy' },
    },
    required: ['sensorId', 'uptime', 'avgResponseTime', 'lastHeartbeat', 'isHealthy'],
};
exports.AttackTrendSchema = {
    type: 'object',
    properties: {
        timestamp: { type: 'string', description: 'Time period' },
        count: { type: 'number', description: 'Attack count in period' },
    },
    required: ['timestamp', 'count'],
};
exports.AttackTrendsSchema = {
    type: 'array',
    items: exports.AttackTrendSchema,
};
exports.AlertSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', description: 'Alert type (DDoS_PATTERN, PORT_SCAN, etc)' },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Alert severity',
        },
        message: { type: 'string', description: 'Alert message' },
        timestamp: { type: 'string', format: 'date-time', description: 'Alert time' },
        sourceIp: { type: ['string', 'null'], description: 'Source IP if applicable' },
    },
    required: ['type', 'severity', 'message', 'timestamp'],
};
exports.AlertsSchema = {
    type: 'array',
    items: exports.AlertSchema,
};
exports.RiskLevelSchema = {
    type: 'object',
    properties: {
        level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Current network risk level',
        },
    },
    required: ['level'],
};
