"use strict";
/**
 * Dashboard API Routes - Real-time dashboard data and alerts
 * Provides sensor status, active threats, and risk assessment
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
exports.default = dashboardRoutes;
const dashboardService = __importStar(require("../../services/dashboard.service"));
const dashboard_types_1 = require("../../types/dashboard.types");
async function dashboardRoutes(fastify) {
    /**
     * GET /api/dashboard/summary
     * Get dashboard summary (key metrics overview)
     */
    fastify.get('/dashboard/summary', {
        schema: {
            response: { 200: dashboard_types_1.DashboardSummarySchema },
        },
    }, async (request, reply) => {
        try {
            const summary = await dashboardService.getDashboardSummary();
            return reply.code(200).send(summary);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get dashboard summary';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/sensors
     * Get all sensor statuses
     */
    fastify.get('/dashboard/sensors', {
        schema: {
            response: { 200: dashboard_types_1.SensorStatusListSchema },
        },
    }, async (request, reply) => {
        try {
            const statuses = await dashboardService.getSensorStatuses();
            return reply.code(200).send(statuses);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get sensor statuses';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/threats
     * Get active/recent threats
     */
    fastify.get('/dashboard/threats', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    hours: { type: 'string', description: 'Look back N hours (default: 1)' },
                    limit: { type: 'string', description: 'Maximum threats to return (default: 100)' },
                },
            },
            response: { 200: dashboard_types_1.ActiveThreatsSchema },
        },
    }, async (request, reply) => {
        try {
            const hours = parseInt(request.query.hours || '1');
            const limit = parseInt(request.query.limit || '100');
            const threats = await dashboardService.getActiveThreats(hours, limit);
            return reply.code(200).send(threats);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get active threats';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/sensor/:id/health
     * Get health metrics for a specific sensor
     */
    fastify.get('/dashboard/sensor/:id/health', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string', description: 'Sensor ID' },
                },
            },
            response: { 200: dashboard_types_1.SensorHealthSchema },
        },
    }, async (request, reply) => {
        try {
            const sensorId = parseInt(request.params.id);
            if (isNaN(sensorId)) {
                return reply.code(400).send({ message: 'Invalid sensor ID' });
            }
            const health = await dashboardService.getSensorHealth(sensorId);
            return reply.code(200).send(health);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get sensor health';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/trends
     * Get attack trends over time
     */
    fastify.get('/dashboard/trends', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    hours: { type: 'string', description: 'Number of hours to look back (default: 24)' },
                },
            },
            response: { 200: dashboard_types_1.AttackTrendsSchema },
        },
    }, async (request, reply) => {
        try {
            const hours = parseInt(request.query.hours || '24');
            const trends = await dashboardService.getAttackTrends(hours);
            return reply.code(200).send(trends);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get trends';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/alerts
     * Get current alerts
     */
    fastify.get('/dashboard/alerts', {
        schema: {
            response: { 200: dashboard_types_1.AlertsSchema },
        },
    }, async (request, reply) => {
        try {
            const alerts = await dashboardService.getAlerts();
            return reply.code(200).send(alerts);
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get alerts';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/dashboard/risk
     * Get current network risk level
     */
    fastify.get('/dashboard/risk', {
        schema: {
            response: { 200: dashboard_types_1.RiskLevelSchema },
        },
    }, async (request, reply) => {
        try {
            const level = await dashboardService.getRiskLevel();
            return reply.code(200).send({ level });
        }
        catch (error) {
            fastify.log.error(error);
            const message = error instanceof Error ? error.message : 'Failed to get risk level';
            return reply.code(500).send({ message });
        }
    });
}
