/**
 * Job Queue Service
 * Manages background jobs for event forwarding to external integrations
 */

import Queue from 'bull';
import { EmailNotificationService } from './email-notification.service';
import SplunkForwarderService from './integrations/splunk-forwarder.service';
import ArcSightForwarderService from './integrations/arcsight-forwarder.service';
import ElasticsearchForwarderService from './integrations/elasticsearch-forwarder.service';
import HPFeedsLoggerService from './integrations/hpfeeds-logger.service';
import IntegrationService from './integration.service';
import { globalLogger } from '../lib/logger';

// Redis URL (defaults to local Redis)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Job queue for attack events
 */
export const attackEventQueue = new Queue('attack-events', REDIS_URL);

/**
 * Job queue for security alerts
 */
export const securityAlertQueue = new Queue('security-alerts', REDIS_URL);

/**
 * Job queue for statistics exports
 */
export const statisticsQueue = new Queue('statistics', REDIS_URL);

/**
 * Configure attack event job processing
 */
export async function configureAttackEventProcessor() {
  attackEventQueue.process(async (job) => {
    const { attackData } = job.data;

    try {
      // Forward to all enabled integrations
      await forwardAttackEvent(attackData);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to forward attack event: ${errorMessage}`);
    }
  });

  // Event listeners
  attackEventQueue.on('failed', (job, err) => {
    globalLogger.error(`Attack event job ${job.id} failed: ${err.message}`);
  });

  attackEventQueue.on('completed', (job) => {
    globalLogger.info(`Attack event job ${job.id} completed`);
  });
}

/**
 * Configure security alert job processing
 */
export async function configureSecurityAlertProcessor() {
  securityAlertQueue.process(async (job) => {
    const { alertType, details, recipientEmails } = job.data;

    try {
      // Send alert emails
      await sendSecurityAlerts(alertType, details, recipientEmails);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send security alerts: ${errorMessage}`);
    }
  });

  // Event listeners
  securityAlertQueue.on('failed', (job, err) => {
    globalLogger.error(`Security alert job ${job.id} failed: ${err.message}`);
  });

  securityAlertQueue.on('completed', (job) => {
    globalLogger.info(`Security alert job ${job.id} completed`);
  });
}

/**
 * Configure statistics job processing
 */
export async function configureStatisticsProcessor() {
  statisticsQueue.process(async (job) => {
    const { period } = job.data;

    try {
      // Export statistics to integrations
      await exportStatistics(period);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to export statistics: ${errorMessage}`);
    }
  });

  // Event listeners
  statisticsQueue.on('failed', (job, err) => {
    globalLogger.error(`Statistics job ${job.id} failed: ${err.message}`);
  });

  statisticsQueue.on('completed', (job) => {
    globalLogger.info(`Statistics job ${job.id} completed`);
  });
}

/**
 * Forward attack event to all configured integrations
 */
async function forwardAttackEvent(attackData: any) {
  const integrations = await IntegrationService.listEnabledIntegrations();

  const forwardPromises = integrations.map(async (integration) => {
    try {
      const config = integration.config;

      switch (integration.type) {
        case 'splunk':
          const splunkService = new SplunkForwarderService(config);
          await splunkService.addEvent(attackData);
          await splunkService.flush();
          break;

        case 'arcsight':
          const arcsightService = new ArcSightForwarderService(config);
          await arcsightService.addEvent(attackData);
          await arcsightService.flush();
          break;

        case 'elasticsearch':
          const elasticService = new ElasticsearchForwarderService(config);
          await elasticService.addEvent(attackData);
          await elasticService.flush();
          break;

        case 'hpfeeds':
          const hpfeedsService = new HPFeedsLoggerService(config);
          await hpfeedsService.addEvent(attackData);
          await hpfeedsService.flush();
          break;

        default:
          globalLogger.warn(`Unknown integration type: ${integration.type}`);
      }

      await IntegrationService.logIntegrationEvent(
        integration.type as any,
        'attack',
        'success',
        undefined,
        attackData
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await IntegrationService.logIntegrationEvent(
        integration.type as any,
        'attack',
        'failed',
        errorMessage,
        attackData
      );
      throw error;
    }
  });

  const results = await Promise.allSettled(forwardPromises);

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      globalLogger.error(`Failed to forward to ${integrations[index].type}: ${error}`);
    }
  });
}

/**
 * Send security alerts via email
 */
async function sendSecurityAlerts(
  alertType: string,
  details: any,
  recipientEmails: string[]
) {
  const emailIntegration = await IntegrationService.getIntegration('email');

  if (!emailIntegration || !emailIntegration.enabled) {
    throw new Error('Email service not configured');
  }

  const emailService = new EmailNotificationService(emailIntegration.config);

  const alertPromises = recipientEmails.map((email) =>
    emailService.sendSecurityAlert(
      email,
      alertType as 'ddos' | 'port_scan' | 'high_severity',
      details
    )
  );

  await Promise.all(alertPromises);

  await IntegrationService.logIntegrationEvent('email', 'alert', 'success', undefined, {
    alertType,
    recipientCount: recipientEmails.length,
  });
}

/**
 * Export statistics to integrations
 */
async function exportStatistics(period: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  globalLogger.info(`Exporting ${period} statistics...`);
  // This would be implemented with actual statistics calculation
  // from the analytics service
}

/**
 * Queue attack event for forwarding
 */
export async function queueAttackEvent(attackData: any, delay?: number) {
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

  return attackEventQueue.add({ attackData }, jobOptions);
}

/**
 * Queue security alert
 */
export async function queueSecurityAlert(
  alertType: string,
  details: any,
  recipientEmails: string[]
) {
  const jobOptions = {
    priority: 10, // Alerts have high priority
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  };

  return securityAlertQueue.add(
    { alertType, details, recipientEmails },
    jobOptions
  );
}

/**
 * Queue statistics export
 */
export async function queueStatisticsExport(period: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  const jobOptions = {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  };

  return statisticsQueue.add({ period }, jobOptions);
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [attackCount, alertCount, statsCount] = await Promise.all([
    attackEventQueue.count(),
    securityAlertQueue.count(),
    statisticsQueue.count(),
  ]);

  return {
    attackEvents: {
      pending: attackCount,
      activeCount: await attackEventQueue.getActiveCount(),
      failedCount: await attackEventQueue.getFailedCount(),
      completedCount: await attackEventQueue.getCompletedCount(),
    },
    securityAlerts: {
      pending: alertCount,
      activeCount: await securityAlertQueue.getActiveCount(),
      failedCount: await securityAlertQueue.getFailedCount(),
      completedCount: await securityAlertQueue.getCompletedCount(),
    },
    statistics: {
      pending: statsCount,
      activeCount: await statisticsQueue.getActiveCount(),
      failedCount: await statisticsQueue.getFailedCount(),
      completedCount: await statisticsQueue.getCompletedCount(),
    },
  };
}

/**
 * Drain all queues
 */
export async function drainQueues() {
  await Promise.all([
    attackEventQueue.drain(),
    securityAlertQueue.drain(),
    statisticsQueue.drain(),
  ]);
}

/**
 * Clean up queue (remove old jobs)
 */
export async function cleanupQueues(days: number = 7) {
  await Promise.all([
    attackEventQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
    securityAlertQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
    statisticsQueue.clean(days * 24 * 60 * 60 * 1000, 'completed'),
  ]);
}

export default {
  attackEventQueue,
  securityAlertQueue,
  statisticsQueue,
  configureAttackEventProcessor,
  configureSecurityAlertProcessor,
  configureStatisticsProcessor,
  queueAttackEvent,
  queueSecurityAlert,
  queueStatisticsExport,
  getQueueStats,
  drainQueues,
  cleanupQueues,
}
