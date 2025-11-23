"use strict";
/**
 * Type definitions and schemas for Analytics API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HourlyFrequencySchema = exports.PortStatsListSchema = exports.PortStatsSchema = exports.CountryStatsListSchema = exports.CountryStatsSchema = exports.SensorStatsListSchema = exports.SensorStatsSchema = exports.GeoHeatmapSchema = exports.GeoHeatmapEntrySchema = exports.TopAttackersSchema = exports.TopAttackerSchema = exports.ProtocolDistributionSchema = exports.ProtocolStatsSchema = exports.TimeSeriesSchema = exports.TimeSeriesPointSchema = exports.AttackStatsSchema = void 0;
exports.AttackStatsSchema = {
    type: 'object',
    properties: {
        totalAttacks: { type: 'number', description: 'Total number of attacks' },
        uniqueAttackers: { type: 'number', description: 'Number of unique attacking IPs' },
        uniqueTargets: { type: 'number', description: 'Number of unique target ports' },
        avgAttacksPerHour: { type: 'number', description: 'Average attacks per hour' },
        avgAttacksPerDay: { type: 'number', description: 'Average attacks per day' },
    },
    required: ['totalAttacks', 'uniqueAttackers', 'uniqueTargets', 'avgAttacksPerHour', 'avgAttacksPerDay'],
};
exports.TimeSeriesPointSchema = {
    type: 'object',
    properties: {
        timestamp: { type: 'string', description: 'Timestamp for this data point' },
        count: { type: 'number', description: 'Number of attacks in this period' },
        period: {
            type: 'string',
            enum: ['hourly', 'daily', 'weekly', 'monthly'],
            description: 'Time period granularity',
        },
    },
    required: ['timestamp', 'count', 'period'],
};
exports.TimeSeriesSchema = {
    type: 'array',
    items: exports.TimeSeriesPointSchema,
};
exports.ProtocolStatsSchema = {
    type: 'object',
    properties: {
        protocol: { type: 'string', description: 'Protocol name' },
        count: { type: 'number', description: 'Number of attacks using this protocol' },
        percentage: { type: 'number', description: 'Percentage of total attacks' },
    },
    required: ['protocol', 'count', 'percentage'],
};
exports.ProtocolDistributionSchema = {
    type: 'array',
    items: exports.ProtocolStatsSchema,
};
exports.TopAttackerSchema = {
    type: 'object',
    properties: {
        sourceIp: { type: 'string', description: 'Attacking IP address' },
        attackCount: { type: 'number', description: 'Total attacks from this IP' },
        lastSeen: { type: 'string', format: 'date-time', description: 'Last attack timestamp' },
        uniqueTargets: { type: 'number', description: 'Number of unique target ports' },
    },
    required: ['sourceIp', 'attackCount', 'lastSeen', 'uniqueTargets'],
};
exports.TopAttackersSchema = {
    type: 'array',
    items: exports.TopAttackerSchema,
};
exports.GeoHeatmapEntrySchema = {
    type: 'object',
    properties: {
        country: { type: 'string', description: 'Country name or code' },
        code: { type: ['string', 'null'], description: 'ISO country code' },
        attackCount: { type: 'number', description: 'Total attacks from this country' },
        uniqueIps: { type: 'number', description: 'Number of unique IPs from this country' },
        latitude: { type: ['number', 'null'], description: 'Country center latitude' },
        longitude: { type: ['number', 'null'], description: 'Country center longitude' },
    },
    required: ['country', 'attackCount', 'uniqueIps'],
};
exports.GeoHeatmapSchema = {
    type: 'array',
    items: exports.GeoHeatmapEntrySchema,
};
exports.SensorStatsSchema = {
    type: 'object',
    properties: {
        sensorId: { type: 'number', description: 'Sensor ID' },
        sensorName: { type: 'string', description: 'Sensor name' },
        sensorUuid: { type: 'string', description: 'Sensor UUID' },
        totalAttacks: { type: 'number', description: 'Total attacks on this sensor' },
        uniqueAttackers: { type: 'number', description: 'Number of unique attacking IPs' },
        lastAttackTime: { type: ['string', 'null'], format: 'date-time', description: 'Last attack timestamp' },
        primaryProtocol: { type: 'string', description: 'Most common attack protocol' },
    },
    required: ['sensorId', 'sensorName', 'sensorUuid', 'totalAttacks', 'uniqueAttackers', 'primaryProtocol'],
};
exports.SensorStatsListSchema = {
    type: 'array',
    items: exports.SensorStatsSchema,
};
exports.CountryStatsSchema = {
    type: 'object',
    properties: {
        country: { type: 'string', description: 'Country code or name' },
        count: { type: 'number', description: 'Number of attacks' },
    },
    required: ['country', 'count'],
};
exports.CountryStatsListSchema = {
    type: 'array',
    items: exports.CountryStatsSchema,
};
exports.PortStatsSchema = {
    type: 'object',
    properties: {
        port: { type: 'number', description: 'Target port number' },
        count: { type: 'number', description: 'Number of attacks on this port' },
    },
    required: ['port', 'count'],
};
exports.PortStatsListSchema = {
    type: 'array',
    items: exports.PortStatsSchema,
};
exports.HourlyFrequencySchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            hour: { type: 'number', minimum: 0, maximum: 23, description: 'Hour of day (0-23)' },
            count: { type: 'number', description: 'Attacks in this hour' },
        },
        required: ['hour', 'count'],
    },
};
