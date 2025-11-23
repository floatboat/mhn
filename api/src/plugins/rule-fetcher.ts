/**
 * Rule Fetcher Plugin - Schedule automated rule fetching using node-cron
 * Fetches rules on a schedule and handles retries
 */

import * as cron from 'node-cron';
import { FastifyInstance } from 'fastify';
import { processFailedRetries } from '../services/rule-fetcher-job.service';

/**
 * Track active cron jobs
 */
const activeCronJobs = new Map<string, cron.ScheduledTask>();

/**
 * Initialize the rule fetcher plugin
 * Sets up cron jobs for:
 * - Periodic rule fetching (daily at 2 AM UTC)
 * - Retry processing (every 5 minutes)
 */
export async function ruleFetcherPlugin(fastify: FastifyInstance) {
  // Schedule retry processing every 5 minutes
  const retrySchedule = '*/5 * * * *'; // Every 5 minutes

  const retryTask = cron.schedule(retrySchedule, async () => {
    try {
      fastify.log.debug('Processing failed fetch job retries...');
      const results = await processFailedRetries();
      if (results.length > 0) {
        fastify.log.info({ count: results.length }, 'Processed failed fetch job retries');
      }
    } catch (error) {
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
export function scheduleCustomFetch(cronExpression: string, jobName: string, handler: () => Promise<void>): string {
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
export function stopScheduledFetch(jobName: string): boolean {
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
export function getActiveCronJobs(): string[] {
  return Array.from(activeCronJobs.keys());
}

/**
 * Get status of a specific cron job
 */
export function getCronJobStatus(jobName: string) {
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
