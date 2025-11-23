"use strict";
/**
 * Rule Fetcher Plugin - Schedule automated rule fetching using node-cron
 * Fetches rules on a schedule and handles retries
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
exports.ruleFetcherPlugin = ruleFetcherPlugin;
exports.scheduleCustomFetch = scheduleCustomFetch;
exports.stopScheduledFetch = stopScheduledFetch;
exports.getActiveCronJobs = getActiveCronJobs;
exports.getCronJobStatus = getCronJobStatus;
const cron = __importStar(require("node-cron"));
const rule_fetcher_job_service_1 = require("../services/rule-fetcher-job.service");
/**
 * Track active cron jobs
 */
const activeCronJobs = new Map();
/**
 * Initialize the rule fetcher plugin
 * Sets up cron jobs for:
 * - Periodic rule fetching (daily at 2 AM UTC)
 * - Retry processing (every 5 minutes)
 */
async function ruleFetcherPlugin(fastify) {
    // Schedule retry processing every 5 minutes
    const retrySchedule = '*/5 * * * *'; // Every 5 minutes
    const retryTask = cron.schedule(retrySchedule, async () => {
        try {
            fastify.log.debug('Processing failed fetch job retries...');
            const results = await (0, rule_fetcher_job_service_1.processFailedRetries)();
            if (results.length > 0) {
                fastify.log.info({ count: results.length }, 'Processed failed fetch job retries');
            }
        }
        catch (error) {
            fastify.log.error(error, 'Failed to process fetch job retries');
        }
    });
    activeCronJobs.set('rule-fetcher-retry', retryTask);
    fastify.log.info('Rule fetcher plugin initialized');
    // Clean up on app close
    fastify.addHook('onClose', async () => {
        for (const [name, task] of activeCronJobs.entries()) {
            task.stop();
            fastify.log.debug(`Stopped cron job: ${name}`);
        }
    });
}
/**
 * Schedule a custom fetch job with cron expression
 * Useful for sources that need custom schedules
 */
function scheduleCustomFetch(cronExpression, jobName, handler) {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    // Stop existing job with same name if present
    if (activeCronJobs.has(jobName)) {
        const existing = activeCronJobs.get(jobName);
        if (existing) {
            existing.stop();
        }
    }
    // Create new scheduled task
    const task = cron.schedule(cronExpression, handler);
    activeCronJobs.set(jobName, task);
    return jobName;
}
/**
 * Stop a scheduled fetch job
 */
function stopScheduledFetch(jobName) {
    const task = activeCronJobs.get(jobName);
    if (!task) {
        return false;
    }
    task.stop();
    activeCronJobs.delete(jobName);
    return true;
}
/**
 * Get all active cron jobs
 */
function getActiveCronJobs() {
    return Array.from(activeCronJobs.keys());
}
/**
 * Get status of a specific cron job
 */
function getCronJobStatus(jobName) {
    const task = activeCronJobs.get(jobName);
    if (!task) {
        return null;
    }
    return {
        name: jobName,
        active: task.status === 'scheduled',
        nextDate: task.nextDate().toISOString(),
    };
}
