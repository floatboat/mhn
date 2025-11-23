"use strict";
/**
 * Job Queue Plugin
 * Initializes Bull queues and sets up job processors
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = __importDefault(require("@fastify/plugin"));
const job_queue_service_1 = require("../services/job-queue.service");
/**
 * Job Queue Plugin
 * Registers job processors and hooks for lifecycle management
 */
exports.default = (0, plugin_1.default)(async function jobQueuePlugin(fastify) {
    try {
        // Configure job processors
        await (0, job_queue_service_1.configureAttackEventProcessor)();
        await (0, job_queue_service_1.configureSecurityAlertProcessor)();
        await (0, job_queue_service_1.configureStatisticsProcessor)();
        fastify.log.info('Job queue processors configured');
        // Clean up old jobs on startup
        await (0, job_queue_service_1.cleanupQueues)(7); // Remove jobs older than 7 days
        // Drain queues on shutdown
        fastify.addHook('onClose', async () => {
            fastify.log.info('Draining job queues...');
            await (0, job_queue_service_1.drainQueues)();
            fastify.log.info('Job queues drained');
        });
    }
    catch (error) {
        fastify.log.error(error, 'Failed to initialize job queue plugin');
        // Don't fail app startup if Redis is unavailable
        // Queues will be retried later
    }
});
