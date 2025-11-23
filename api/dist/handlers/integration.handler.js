"use strict";
/**
 * Integration Request Handlers
 * Handles HTTP requests for integration management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listIntegrationsHandler = listIntegrationsHandler;
exports.getIntegrationHandler = getIntegrationHandler;
exports.configureIntegrationHandler = configureIntegrationHandler;
exports.deleteIntegrationHandler = deleteIntegrationHandler;
exports.toggleIntegrationHandler = toggleIntegrationHandler;
exports.testIntegrationHandler = testIntegrationHandler;
exports.getIntegrationLogsHandler = getIntegrationLogsHandler;
exports.getIntegrationStatsHandler = getIntegrationStatsHandler;
exports.listAlertsHandler = listAlertsHandler;
exports.createAlertHandler = createAlertHandler;
exports.getAlertHandler = getAlertHandler;
exports.updateAlertHandler = updateAlertHandler;
exports.deleteAlertHandler = deleteAlertHandler;
exports.toggleAlertHandler = toggleAlertHandler;
const integration_service_1 = __importDefault(require("../services/integration.service"));
const alert_service_1 = __importDefault(require("../services/alert.service"));
/**
 * GET /api/integration - List all integrations
 */
async function listIntegrationsHandler(request, reply) {
    const integrations = await integration_service_1.default.listIntegrations();
    // Remove sensitive config data from response
    const safe = integrations.map((int) => ({
        id: int.id,
        type: int.type,
        name: int.name,
        enabled: int.enabled,
        testStatus: int.testStatus,
        testMessage: int.testMessage,
        lastTestAt: int.lastTestAt,
        createdAt: int.createdAt,
        updatedAt: int.updatedAt,
    }));
    reply.code(200).send(safe);
}
/**
 * GET /api/integration/:type - Get specific integration
 */
async function getIntegrationHandler(request, reply) {
    const { type } = request.params;
    const integration = await integration_service_1.default.getIntegration(type);
    if (!integration) {
        reply.code(404).send({ error: `Integration ${type} not configured` });
        return;
    }
    // Remove sensitive config from response
    reply.code(200).send({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        enabled: integration.enabled,
        testStatus: integration.testStatus,
        lastTestAt: integration.lastTestAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
    });
}
/**
 * POST /api/integration/:type - Create or update integration
 */
async function configureIntegrationHandler(request, reply) {
    const { type } = request.params;
    const { name, ...config } = request.body;
    try {
        const existing = await integration_service_1.default.getIntegration(type);
        let integration;
        if (existing) {
            integration = await integration_service_1.default.updateIntegration(type, config, name);
            reply.code(200).send({
                id: integration.id,
                type: integration.type,
                name: integration.name,
                enabled: integration.enabled,
                message: 'Integration updated successfully',
            });
        }
        else {
            integration = await integration_service_1.default.createIntegration(type, config, name);
            reply.code(201).send({
                id: integration.id,
                type: integration.type,
                name: integration.name,
                enabled: integration.enabled,
                message: 'Integration created successfully',
            });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to configure integration';
        reply.code(400).send({ error: message });
    }
}
/**
 * DELETE /api/integration/:type - Delete integration
 */
async function deleteIntegrationHandler(request, reply) {
    const { type } = request.params;
    try {
        await integration_service_1.default.deleteIntegration(type);
        reply.code(200).send({ message: `Integration ${type} deleted successfully` });
    }
    catch (error) {
        reply.code(404).send({ error: `Integration ${type} not found` });
    }
}
/**
 * PUT /api/integration/:type/toggle - Enable/disable integration
 */
async function toggleIntegrationHandler(request, reply) {
    const { type } = request.params;
    const { enabled } = request.body;
    try {
        const integration = await integration_service_1.default.toggleIntegration(type, enabled);
        reply.code(200).send({
            id: integration.id,
            type: integration.type,
            enabled: integration.enabled,
            message: `Integration ${type} ${enabled ? 'enabled' : 'disabled'} successfully`,
        });
    }
    catch (error) {
        reply.code(404).send({ error: `Integration ${type} not found` });
    }
}
/**
 * POST /api/integration/:type/test - Test integration connection
 */
async function testIntegrationHandler(request, reply) {
    const { type } = request.params;
    try {
        const result = await integration_service_1.default.testIntegration(type);
        reply.code(result.success ? 200 : 400).send({
            success: result.success,
            message: result.message,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Test failed';
        reply.code(500).send({ success: false, message });
    }
}
/**
 * GET /api/integration/:type/logs - Get integration logs
 */
async function getIntegrationLogsHandler(request, reply) {
    const { type } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit) : 100;
    const logs = await integration_service_1.default.getIntegrationLogs(type, limit);
    reply.code(200).send({
        type,
        logs,
        count: logs.length,
    });
}
/**
 * GET /api/integration/:type/stats - Get integration statistics
 */
async function getIntegrationStatsHandler(request, reply) {
    const { type } = request.params;
    const stats = await integration_service_1.default.getIntegrationStats(type);
    if (!stats) {
        reply.code(404).send({ error: `Integration ${type} not found` });
        return;
    }
    reply.code(200).send({
        type,
        stats,
    });
}
/**
 * GET /api/alert - List all alerts
 */
async function listAlertsHandler(request, reply) {
    const alerts = await alert_service_1.default.listAlerts();
    reply.code(200).send(alerts);
}
/**
 * POST /api/alert - Create alert configuration
 */
async function createAlertHandler(request, reply) {
    try {
        const alert = await alert_service_1.default.createAlert(request.body);
        reply.code(201).send(alert);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create alert';
        reply.code(400).send({ error: message });
    }
}
/**
 * GET /api/alert/:id - Get alert by ID
 */
async function getAlertHandler(request, reply) {
    const { id } = request.params;
    const alert = await alert_service_1.default.getAlert(parseInt(id));
    if (!alert) {
        reply.code(404).send({ error: 'Alert not found' });
        return;
    }
    reply.code(200).send(alert);
}
/**
 * PUT /api/alert/:id - Update alert configuration
 */
async function updateAlertHandler(request, reply) {
    try {
        const { id } = request.params;
        const alert = await alert_service_1.default.updateAlert(parseInt(id), request.body);
        reply.code(200).send(alert);
    }
    catch (error) {
        reply.code(404).send({ error: 'Alert not found' });
    }
}
/**
 * DELETE /api/alert/:id - Delete alert
 */
async function deleteAlertHandler(request, reply) {
    try {
        const { id } = request.params;
        await alert_service_1.default.deleteAlert(parseInt(id));
        reply.code(200).send({ message: 'Alert deleted successfully' });
    }
    catch (error) {
        reply.code(404).send({ error: 'Alert not found' });
    }
}
/**
 * PUT /api/alert/:id/toggle - Enable/disable alert
 */
async function toggleAlertHandler(request, reply) {
    try {
        const { id } = request.params;
        const { enabled } = request.body;
        const alert = await alert_service_1.default.toggleAlert(parseInt(id), enabled);
        reply.code(200).send({
            ...alert,
            message: `Alert ${enabled ? 'enabled' : 'disabled'} successfully`,
        });
    }
    catch (error) {
        reply.code(404).send({ error: 'Alert not found' });
    }
}
exports.default = {
    listIntegrationsHandler,
    getIntegrationHandler,
    configureIntegrationHandler,
    deleteIntegrationHandler,
    toggleIntegrationHandler,
    testIntegrationHandler,
    getIntegrationLogsHandler,
    getIntegrationStatsHandler,
    listAlertsHandler,
    createAlertHandler,
    getAlertHandler,
    updateAlertHandler,
    deleteAlertHandler,
    toggleAlertHandler,
};
