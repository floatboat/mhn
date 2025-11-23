"use strict";
/**
 * Job Queue Service
 * Manages background jobs for event forwarding to external integrations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statisticsQueue = exports.securityAlertQueue = exports.attackEventQueue = void 0;
exports.configureAttackEventProcessor = configureAttackEventProcessor;
exports.configureSecurityAlertProcessor = configureSecurityAlertProcessor;
exports.configureStatisticsProcessor = configureStatisticsProcessor;
exports.queueAttackEvent = queueAttackEvent;
exports.queueSecurityAlert = queueSecurityAlert;
exports.queueStatisticsExport = queueStatisticsExport;
exports.getQueueStats = getQueueStats;
exports.drainQueues = drainQueues;
exports.cleanupQueues = cleanupQueues;
const bull_1 = __importDefault(require("bull"));
const email_notification_service_1 = __importDefault(require("./email-notification.service"));
const splunk_forwarder_service_1 = __importDefault(require("./integrations/splunk-forwarder.service"));
const arcsight_forwarder_service_1 = __importDefault(require("./integrations/arcsight-forwarder.service"));
const elasticsearch_forwarder_service_1 = __importDefault(require("./integrations/elasticsearch-forwarder.service"));
const hpfeeds_logger_service_1 = __importDefault(require("./integrations/hpfeeds-logger.service"));
const integration_service_1 = __importDefault(require("./integration.service"));
// Redis URL (defaults to local Redis)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
/**
 * Job queue for attack events
 */
exports.attackEventQueue = new bull_1.default('attack-events', REDIS_URL);
/**
 * Job queue for security alerts
 */
exports.securityAlertQueue = new bull_1.default('security-alerts', REDIS_URL);
/**
 * Job queue for statistics exports
 */
exports.statisticsQueue = new bull_1.default('statistics', REDIS_URL);
/**
 * Configure attack event job processing
 */
async function configureAttackEventProcessor() {
    exports.attackEventQueue.process(async (job) => {
        const { attackData } = job.data;
        try {
            // Forward to all enabled integrations
            await forwardAttackEvent(attackData);
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to forward attack event: ${errorMessage}`);
        }
    });
    // Event listeners
    exports.attackEventQueue.on('failed', (job, err) => {
        console.error(`Attack event job ${job.id} failed:`, err.message);
    });
    exports.attackEventQueue.on('completed', (job) => {
        console.log(`Attack event job ${job.id} completed`);
    });
}
/**
 * Configure security alert job processing
 */
async function configureSecurityAlertProcessor() {
    exports.securityAlertQueue.process(async (job) => {
        const { alertType, details, recipientEmails } = job.data;
        try {
            // Send alert emails
            await sendSecurityAlerts(alertType, details, recipientEmails);
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to send security alerts: ${errorMessage}`);
        }
    });
    // Event listeners
    exports.securityAlertQueue.on('failed', (job, err) => {
        console.error(`Security alert job ${job.id} failed:`, err.message);
    });
    exports.securityAlertQueue.on('completed', (job) => {
        console.log(`Security alert job ${job.id} completed`);
    });
}
/**
 * Configure statistics job processing
 */
async function configureStatisticsProcessor() {
    exports.statisticsQueue.process(async (job) => {
        const { period } = job.data;
        try {
            // Export statistics to integrations
            await exportStatistics(period);
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to export statistics: ${errorMessage}`);
        }
    });
    // Event listeners
    exports.statisticsQueue.on('failed', (job, err) => {
        console.error(`Statistics job ${job.id} failed:`, err.message);
    });
    exports.statisticsQueue.on('completed', (job) => {
        console.log(`Statistics job ${job.id} completed`);
    });
}
/**
 * Forward attack event to all configured integrations
 */
async function forwardAttackEvent(attackData) {
    const integrations = await integration_service_1.default.listEnabledIntegrations();
    const forwardPromises = integrations.map(async (integration) => {
        try {
            const config = integration.config;
            switch (integration.type) {
                case 'splunk':
                    const splunkService = new splunk_forwarder_service_1.default(config);
                    await splunkService.addEvent(attackData);
                    await splunkService.flush();
                    break;
                case 'arcsight':
                    const arcsightService = new arcsight_forwarder_service_1.default(config);
                    await arcsightService.addEvent(attackData);
                    await arcsightService.flush();
                    break;
                case 'elasticsearch':
                    const elasticService = new elasticsearch_forwarder_service_1.default(config);
                    await elasticService.addEvent(attackData);
                    await elasticService.flush();
                    break;
                case 'hpfeeds':
                    const hpfeedsService = new hpfeeds_logger_service_1.default(config);
                    await hpfeedsService.addEvent(attackData);
                    await hpfeedsService.flush();
                    break;
                default:
                    console.warn(`Unknown integration type: ${integration.type}`);
            }
            await integration_service_1.default.logIntegrationEvent(integration.type, 'attack', 'success', undefined, attackData);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await integration_service_1.default.logIntegrationEvent(integration.type, 'attack', 'failed', errorMessage, attackData);
            throw error;
        }
    });
    const results = await Promise.allSettled(forwardPromises);
    // Log any failures
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed to forward to ${integrations[index].type}:`, result.reason);
        }
    });
}
/**
 * Send security alerts via email
 */
async function sendSecurityAlerts(alertType, details, recipientEmails) {
    const emailIntegration = await integration_service_1.default.getIntegration('email');
    if (!emailIntegration || !emailIntegration.enabled) {
        throw new Error('Email service not configured');
    }
    const emailService = new email_notification_service_1.default(emailIntegration.config);
    const alertPromises = recipientEmails.map((email) => emailService.sendSecurityAlert(email, alertType, details));
    await Promise.all(alertPromises);
    await integration_service_1.default.logIntegrationEvent('email', 'alert', 'success', undefined, {
        alertType,
        recipientCount: recipientEmails.length,
    });
}
/**
 * Export statistics to integrations
 */
async function exportStatistics(period) {
    console.log(`Exporting ${period} statistics...`);
    // This would be implemented with actual statistics calculation
    // from the analytics service
}
/**
 * Queue attack event for forwarding
 */
async function queueAttackEvent(attackData, delay) {
    const jobOptions = {
        attempts: 3, // Retry up to 3 times
        backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2s, exponential backoff
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for inspection
        ...(delay && { delay }),
    };
    return exports.attackEventQueue.add({ attackData }, jobOptions);
}
/**
 * Queue security alert
 */
async function queueSecurityAlert(alertType, details, recipientEmails) {
    const jobOptions = {
        priority: 10, // Alerts have high priority
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
    };
    return exports.securityAlertQueue.add({ alertType, details, recipientEmails }, jobOptions);
}
/**
 * Queue statistics export
 */
async function queueStatisticsExport(period) {
    const jobOptions = {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
    };
    return exports.statisticsQueue.add({ period }, jobOptions);
}
/**
 * Get queue stats
 */
async function getQueueStats() {
    const [attackCount, alertCount, statsCount] = await Promise.all([
        exports.attackEventQueue.count(),
        exports.securityAlertQueue.count(),
        exports.statisticsQueue.count(),
    ]);
    return {
        attackEvents: {
            pending: attackCount,
            activeCount: await exports.attackEventQueue.getActiveCount(),
            failedCount: await exports.attackEventQueue.getFailedCount(),
            completedCount: await exports.attackEventQueue.getCompletedCount(),
        },
        securityAlerts: {
            pending: alertCount,
            activeCount: await exports.securityAlertQueue.getActiveCount(),
            failedCount: await exports.securityAlertQueue.getFailedCount(),
            completedCount: await exports.securityAlertQueue.getCompletedCount(),
        },
        statistics: {
            pending: statsCount,
            activeCount: await exports.statisticsQueue.getActiveCount(),
            failedCount: await exports.statisticsQueue.getFailedCount(),
            completedCount: await exports.statisticsQueue.getCompletedCount(),
        },
    };
}
/**
 * Drain all queues
 */
async function drainQueues() {
    await Promise.all([
        exports.attackEventQueue.drain(),
        exports.securityAlertQueue.drain(),
        exports.statisticsQueue.drain(),
    ]);
}
/**
 * Clean up queue (remove old jobs)
 */
async function cleanupQueues(days = 7) {
    await Promise.all([
        exports.attackEventQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
        exports.securityAlertQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
        exports.statisticsQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
    ]);
}
exports.default = {
    attackEventQueue: exports.attackEventQueue,
    securityAlertQueue: exports.securityAlertQueue,
    statisticsQueue: exports.statisticsQueue,
    configureAttackEventProcessor,
    configureSecurityAlertProcessor,
    configureStatisticsProcessor,
    queueAttackEvent,
    queueSecurityAlert,
    queueStatisticsExport,
    getQueueStats,
    drainQueues,
    cleanupQueues,
};
