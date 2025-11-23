"use strict";
/**
 * Integration Management Routes
 * Endpoints for configuring external integrations (Splunk, ArcSight, Elasticsearch, HPFeeds, Email)
 * and managing alerts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const integration_handler_1 = require("../../handlers/integration.handler");
const integration_types_1 = require("../../types/integration.types");
async function integrationRoutes(fastify) {
    // Integration Management Endpoints
    // GET /api/integration - List all integrations
    fastify.get('/integration', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'List all configured integrations',
            tags: ['Integrations'],
        },
    }, integration_handler_1.listIntegrationsHandler);
    // GET /api/integration/:type - Get specific integration
    fastify.get('/integration/:type', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Get specific integration configuration',
            params: {
                type: 'object',
                required: ['type'],
                properties: {
                    type: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.getIntegrationHandler);
    // POST /api/integration/:type - Create or update integration
    fastify.post('/integration/:type', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: integration_types_1.configureIntegrationSchema,
    }, integration_handler_1.configureIntegrationHandler);
    // DELETE /api/integration/:type - Delete integration
    fastify.delete('/integration/:type', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Delete integration configuration',
            params: {
                type: 'object',
                required: ['type'],
                properties: {
                    type: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.deleteIntegrationHandler);
    // PUT /api/integration/:type/toggle - Enable/disable integration
    fastify.put('/integration/:type/toggle', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: integration_types_1.toggleIntegrationSchema,
    }, integration_handler_1.toggleIntegrationHandler);
    // POST /api/integration/:type/test - Test integration connection
    fastify.post('/integration/:type/test', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Test integration connection',
            params: {
                type: 'object',
                required: ['type'],
                properties: {
                    type: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.testIntegrationHandler);
    // GET /api/integration/:type/logs - Get integration logs
    fastify.get('/integration/:type/logs', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Get integration event logs',
            params: {
                type: 'object',
                required: ['type'],
                properties: {
                    type: { type: 'string' },
                },
            },
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.getIntegrationLogsHandler);
    // GET /api/integration/:type/stats - Get integration statistics
    fastify.get('/integration/:type/stats', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Get integration event statistics',
            params: {
                type: 'object',
                required: ['type'],
                properties: {
                    type: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.getIntegrationStatsHandler);
    // Alert Management Endpoints
    // GET /api/alert - List all alerts
    fastify.get('/alert', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'List all alert configurations',
            tags: ['Alerts'],
        },
    }, integration_handler_1.listAlertsHandler);
    // POST /api/alert - Create alert configuration
    fastify.post('/alert', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Create new alert configuration',
            body: integration_types_1.alertConfigSchema,
        },
    }, integration_handler_1.createAlertHandler);
    // GET /api/alert/:id - Get alert by ID
    fastify.get('/alert/:id', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Get alert configuration by ID',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.getAlertHandler);
    // PUT /api/alert/:id - Update alert configuration
    fastify.put('/alert/:id', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: integration_types_1.updateAlertSchema,
    }, integration_handler_1.updateAlertHandler);
    // DELETE /api/alert/:id - Delete alert
    fastify.delete('/alert/:id', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: {
            description: 'Delete alert configuration',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' },
                },
            },
        },
    }, integration_handler_1.deleteAlertHandler);
    // PUT /api/alert/:id/toggle - Enable/disable alert
    fastify.put('/alert/:id/toggle', {
        onRequest: [fastify.authenticate, fastify.requireRole(['admin'])],
        schema: integration_types_1.toggleAlertSchema,
    }, integration_handler_1.toggleAlertHandler);
}
exports.default = integrationRoutes;
