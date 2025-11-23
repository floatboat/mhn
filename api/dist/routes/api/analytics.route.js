"use strict";
/**
 * Analytics API Routes - Statistical analysis and trends
 * Provides aggregated data on attacks, protocols, and geographic patterns
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = analyticsRoutes;
const analyticsService = __importStar(require("../../services/analytics.service"));
const analytics_types_1 = require("../../types/analytics.types");
async function analyticsRoutes(fastify) {
    /**
     * GET /api/analytics/attacks/stats
     * Get overall attack statistics
     */
    fastify.get('/analytics/attacks/stats', {
        schema: {
            params: {},
            querystring: {
                type: 'object',
                properties: {
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.AttackStatsSchema },
        },
    }, async (request, reply) => {
        try {
            const { startTime, endTime } = request.query;
            const stats = await analyticsService.getAttackStats(startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(stats);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get attack stats';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/attacks/timeseries
     * Get time-series attack data
     */
    fastify.get('/analytics/attacks/timeseries', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    period: {
                        type: 'string',
                        enum: ['hourly', 'daily', 'weekly', 'monthly'],
                        description: 'Aggregation period',
                    },
                    limit: { type: 'string', description: 'Number of data points' },
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                },
            },
            response: { 200: analytics_types_1.TimeSeriesSchema },
        },
    }, async (request, reply) => {
        try {
            const period = (request.query.period || 'daily');
            const limit = parseInt(request.query.limit || '30');
            const startTime = request.query.startTime ? new Date(request.query.startTime) : undefined;
            const timeseries = await analyticsService.getAttackTimeSeries(period, limit, startTime);
            return reply.code(200).send(timeseries);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get timeseries';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/protocols
     * Get protocol distribution
     */
    fastify.get('/analytics/protocols', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.ProtocolDistributionSchema },
        },
    }, async (request, reply) => {
        try {
            const { startTime, endTime } = request.query;
            const protocols = await analyticsService.getProtocolDistribution(startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(protocols);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get protocols';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/attackers/top
     * Get top attacking IPs
     */
    fastify.get('/analytics/attackers/top', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'string', description: 'Number of top attackers (default: 10)' },
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.TopAttackersSchema },
        },
    }, async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '10');
            const { startTime, endTime } = request.query;
            const topAttackers = await analyticsService.getTopAttackers(limit, startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(topAttackers);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get top attackers';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/geo/heatmap
     * Get geographic heatmap data
     */
    fastify.get('/analytics/geo/heatmap', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.GeoHeatmapSchema },
        },
    }, async (request, reply) => {
        try {
            const { startTime, endTime } = request.query;
            const heatmap = await analyticsService.getGeoHeatmap(startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(heatmap);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get heatmap';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/sensors
     * Get per-sensor statistics
     */
    fastify.get('/analytics/sensors', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.SensorStatsListSchema },
        },
    }, async (request, reply) => {
        try {
            const { startTime, endTime } = request.query;
            const sensorStats = await analyticsService.getSensorStats(startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(sensorStats);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get sensor stats';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/countries
     * Get attack statistics by country
     */
    fastify.get('/analytics/countries', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'string', description: 'Number of countries (default: 50)' },
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.CountryStatsListSchema },
        },
    }, async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '50');
            const { startTime, endTime } = request.query;
            const countries = await analyticsService.getAttacksByCountry(limit, startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(countries);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get countries';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/ports
     * Get attack statistics by target port
     */
    fastify.get('/analytics/ports', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'string', description: 'Number of ports (default: 20)' },
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.PortStatsListSchema },
        },
    }, async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '20');
            const { startTime, endTime } = request.query;
            const ports = await analyticsService.getTopTargetPorts(limit, startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(ports);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get ports';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/analytics/frequency/hourly
     * Get hourly frequency distribution (attacks per hour of day)
     */
    fastify.get('/analytics/frequency/hourly', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    startTime: { type: 'string', format: 'date-time', description: 'Start time' },
                    endTime: { type: 'string', format: 'date-time', description: 'End time' },
                },
            },
            response: { 200: analytics_types_1.HourlyFrequencySchema },
        },
    }, async (request, reply) => {
        try {
            const { startTime, endTime } = request.query;
            const frequency = await analyticsService.getHourlyFrequency(startTime ? new Date(startTime) : undefined, endTime ? new Date(endTime) : undefined);
            return reply.code(200).send(frequency);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get frequency';
            return reply.code(500).send({ message });
        }
    });
}
