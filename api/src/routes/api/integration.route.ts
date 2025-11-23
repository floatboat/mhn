/**
 * Integration Management Routes
 * Endpoints for configuring external integrations (Splunk, ArcSight, Elasticsearch, HPFeeds, Email)
 * and managing alerts
 */

import { FastifyInstance } from 'fastify'
import {
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
} from '../../handlers/integration.handler'
import {
  configureIntegrationSchema,
  toggleIntegrationSchema,
  alertConfigSchema,
  updateAlertSchema,
  toggleAlertSchema,
} from '../../types/integration.types'

async function integrationRoutes(fastify: FastifyInstance) {
  // Integration Management Endpoints

  // GET /api/integration - List all integrations
  fastify.get('/integration', listIntegrationsHandler)

  // GET /api/integration/:type - Get specific integration
  fastify.get('/integration/:type', getIntegrationHandler)

  // POST /api/integration/:type - Create or update integration
  fastify.post(
    '/integration/:type',
    { schema: configureIntegrationSchema },
    configureIntegrationHandler
  )

  // DELETE /api/integration/:type - Delete integration
  fastify.delete('/integration/:type', deleteIntegrationHandler)

  // PUT /api/integration/:type/toggle - Enable/disable integration
  fastify.put(
    '/integration/:type/toggle',
    { schema: toggleIntegrationSchema },
    toggleIntegrationHandler
  )

  // POST /api/integration/:type/test - Test integration connection
  fastify.post('/integration/:type/test', testIntegrationHandler)

  // GET /api/integration/:type/logs - Get integration logs
  fastify.get('/integration/:type/logs', getIntegrationLogsHandler)

  // GET /api/integration/:type/stats - Get integration statistics
  fastify.get('/integration/:type/stats', getIntegrationStatsHandler)

  // Alert Management Endpoints

  // GET /api/alert - List all alerts
  fastify.get('/alert', listAlertsHandler)

  // POST /api/alert - Create alert configuration
  fastify.post(
    '/alert',
    { schema: { body: alertConfigSchema } },
    createAlertHandler
  )

  // GET /api/alert/:id - Get alert by ID
  fastify.get('/alert/:id', getAlertHandler)

  // PUT /api/alert/:id - Update alert configuration
  fastify.put(
    '/alert/:id',
    { schema: updateAlertSchema },
    updateAlertHandler
  )

  // DELETE /api/alert/:id - Delete alert
  fastify.delete('/alert/:id', deleteAlertHandler)

  // PUT /api/alert/:id/toggle - Enable/disable alert
  fastify.put(
    '/alert/:id/toggle',
    { schema: toggleAlertSchema },
    toggleAlertHandler
  )
}

export default integrationRoutes
