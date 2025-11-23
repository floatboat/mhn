"use strict";
/**
 * Integration Service
 * Manages external system configurations (Splunk, ArcSight, Elasticsearch, HPFeeds, Email)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegration = createIntegration;
exports.getIntegration = getIntegration;
exports.listIntegrations = listIntegrations;
exports.listEnabledIntegrations = listEnabledIntegrations;
exports.updateIntegration = updateIntegration;
exports.deleteIntegration = deleteIntegration;
exports.toggleIntegration = toggleIntegration;
exports.testIntegration = testIntegration;
exports.logIntegrationEvent = logIntegrationEvent;
exports.getIntegrationLogs = getIntegrationLogs;
exports.getIntegrationStats = getIntegrationStats;
const prisma_1 = __importDefault(require("../lib/prisma"));
const email_notification_service_1 = __importDefault(require("./email-notification.service"));
const splunk_forwarder_service_1 = __importDefault(require("./integrations/splunk-forwarder.service"));
const arcsight_forwarder_service_1 = __importDefault(require("./integrations/arcsight-forwarder.service"));
const elasticsearch_forwarder_service_1 = __importDefault(require("./integrations/elasticsearch-forwarder.service"));
const hpfeeds_logger_service_1 = __importDefault(require("./integrations/hpfeeds-logger.service"));
/**
 * Create a new integration configuration
 */
async function createIntegration(type, config, name) {
    const existing = await prisma_1.default.integration.findUnique({
        where: { type },
    });
    if (existing) {
        throw new Error(`Integration of type ${type} already exists`);
    }
    return prisma_1.default.integration.create({
        data: {
            type,
            name: name || `${type} Integration`,
            config: config,
            testStatus: 'untested',
        },
    });
}
/**
 * Get integration by type
 */
async function getIntegration(type) {
    return prisma_1.default.integration.findUnique({
        where: { type },
    });
}
/**
 * Get all integrations
 */
async function listIntegrations() {
    return prisma_1.default.integration.findMany({
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Get enabled integrations
 */
async function listEnabledIntegrations() {
    return prisma_1.default.integration.findMany({
        where: { enabled: true },
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Update integration configuration
 */
async function updateIntegration(type, config, name) {
    return prisma_1.default.integration.update({
        where: { type },
        data: {
            config: config,
            ...(name && { name }),
        },
    });
}
/**
 * Delete integration
 */
async function deleteIntegration(type) {
    return prisma_1.default.integration.delete({
        where: { type },
    });
}
/**
 * Enable/disable integration
 */
async function toggleIntegration(type, enabled) {
    return prisma_1.default.integration.update({
        where: { type },
        data: { enabled },
    });
}
/**
 * Test integration connection
 */
async function testIntegration(type) {
    const integration = await getIntegration(type);
    if (!integration) {
        throw new Error(`Integration ${type} not found`);
    }
    const config = integration.config;
    try {
        let success = false;
        let message = '';
        switch (type) {
            case 'email':
                const emailService = new email_notification_service_1.default(config);
                await emailService.testConnection();
                success = true;
                message = 'Email service connection successful';
                break;
            case 'splunk':
                const splunkService = new splunk_forwarder_service_1.default(config);
                await splunkService.testConnection();
                success = true;
                message = 'Splunk HEC connection successful';
                break;
            case 'arcsight':
                const arcsightService = new arcsight_forwarder_service_1.default(config);
                await arcsightService.testConnection();
                success = true;
                message = 'ArcSight connection successful';
                break;
            case 'elasticsearch':
                const elasticService = new elasticsearch_forwarder_service_1.default(config);
                await elasticService.testConnection();
                success = true;
                message = 'Elasticsearch connection successful';
                break;
            case 'hpfeeds':
                const hpfeedsService = new hpfeeds_logger_service_1.default(config);
                await hpfeedsService.testConnection();
                success = true;
                message = 'HPFeeds connection successful';
                break;
            default:
                message = `Unknown integration type: ${type}`;
        }
        // Update test status
        await prisma_1.default.integration.update({
            where: { type },
            data: {
                testStatus: success ? 'success' : 'failed',
                testMessage: message,
                lastTestAt: new Date(),
            },
        });
        return { success, message };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Update test status
        await prisma_1.default.integration.update({
            where: { type },
            data: {
                testStatus: 'failed',
                testMessage: errorMessage,
                lastTestAt: new Date(),
            },
        });
        return { success: false, message: errorMessage };
    }
}
/**
 * Log integration event
 */
async function logIntegrationEvent(type, eventType, status, errorMessage, eventData, retryCount) {
    const integration = await getIntegration(type);
    if (!integration) {
        return;
    }
    await prisma_1.default.integrationLog.create({
        data: {
            integrationId: integration.id,
            eventType,
            status,
            errorMessage,
            eventData: eventData,
            retryCount: retryCount || 0,
        },
    });
}
/**
 * Get integration logs
 */
async function getIntegrationLogs(type, limit = 100) {
    const integration = await getIntegration(type);
    if (!integration) {
        return [];
    }
    return prisma_1.default.integrationLog.findMany({
        where: { integrationId: integration.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
/**
 * Get integration statistics
 */
async function getIntegrationStats(type) {
    const integration = await getIntegration(type);
    if (!integration) {
        return null;
    }
    const logs = await prisma_1.default.integrationLog.groupBy({
        by: ['status'],
        where: { integrationId: integration.id },
        _count: true,
    });
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        retrying: 0,
    };
    logs.forEach((log) => {
        stats[log.status] = log._count;
        stats.total += log._count;
    });
    return {
        ...stats,
        lastTestAt: integration.lastTestAt,
        testStatus: integration.testStatus,
    };
}
exports.default = {
    createIntegration,
    getIntegration,
    listIntegrations,
    listEnabledIntegrations,
    updateIntegration,
    deleteIntegration,
    toggleIntegration,
    testIntegration,
    logIntegrationEvent,
    getIntegrationLogs,
    getIntegrationStats,
};
