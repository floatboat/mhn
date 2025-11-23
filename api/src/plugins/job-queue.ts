/**
 * Job Queue Plugin
 * Initializes Bull queues and sets up job processors
 */

import { FastifyInstance } from 'fastify';
import {
  configureAttackEventProcessor,
  configureSecurityAlertProcessor,
  configureStatisticsProcessor,
  cleanupQueues,
  drainQueues,
} from '../services/job-queue.service';

/**
 * Job Queue Plugin
 * Registers job processors and hooks for lifecycle management
 */
export default async function jobQueuePlugin(fastify: FastifyInstance) {
  try {
    // Configure job processors
    await configureAttackEventProcessor();
    await configureSecurityAlertProcessor();
    await configureStatisticsProcessor();

    fastify.log.info('Job queue processors configured');

    // Clean up old jobs on startup
    await cleanupQueues(7); // Remove jobs older than 7 days

    // Drain queues on shutdown
    fastify.addHook('onClose', async () => {
      fastify.log.info('Draining job queues...');
      await drainQueues();
      fastify.log.info('Job queues drained');
    });
  } catch (error) {
    fastify.log.error(error, 'Failed to initialize job queue plugin');
    // Don't fail app startup if Redis is unavailable
    // Queues will be retried later
  }
}
