/**
 * Integration Request Handlers
 * Handles HTTP requests for integration management
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import IntegrationService, { IntegrationType, IntegrationConfig } from '../services/integration.service'
import AlertService, { AlertConfig } from '../services/alert.service'

/**
 * GET /api/integration - List all integrations
 */
export async function listIntegrationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const integrations = await IntegrationService.listIntegrations()

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
  }))

  reply.code(200).send(safe)
}

/**
 * GET /api/integration/:type - Get specific integration
 */
export async function getIntegrationHandler(
  request: FastifyRequest<{
    Params: { type: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params

  const integration = await IntegrationService.getIntegration(type as IntegrationType)
  if (!integration) {
    reply.code(404).send({ error: `Integration ${type} not configured` })
    return
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
  })
}

/**
 * POST /api/integration/:type - Create or update integration
 */
export async function configureIntegrationHandler(
  request: FastifyRequest<{
    Params: { type: string }
    Body: IntegrationConfig & { name?: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params
  const { name, ...config } = request.body

  try {
    const existing = await IntegrationService.getIntegration(type as IntegrationType)

    let integration
    if (existing) {
      integration = await IntegrationService.updateIntegration(type as IntegrationType, config, name)
      reply.code(200).send({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        enabled: integration.enabled,
        message: 'Integration updated successfully',
      })
    } else {
      integration = await IntegrationService.createIntegration(type as IntegrationType, config, name)
      reply.code(201).send({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        enabled: integration.enabled,
        message: 'Integration created successfully',
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to configure integration'
    reply.code(400).send({ error: message })
  }
}

/**
 * DELETE /api/integration/:type - Delete integration
 */
export async function deleteIntegrationHandler(
  request: FastifyRequest<{
    Params: { type: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params

  try {
    await IntegrationService.deleteIntegration(type as IntegrationType)
    reply.code(200).send({ message: `Integration ${type} deleted successfully` })
  } catch (error) {
    reply.code(404).send({ error: `Integration ${type} not found` })
  }
}

/**
 * PUT /api/integration/:type/toggle - Enable/disable integration
 */
export async function toggleIntegrationHandler(
  request: FastifyRequest<{
    Params: { type: string }
    Body: { enabled: boolean }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params
  const { enabled } = request.body

  try {
    const integration = await IntegrationService.toggleIntegration(type as IntegrationType, enabled)

    reply.code(200).send({
      id: integration.id,
      type: integration.type,
      enabled: integration.enabled,
      message: `Integration ${type} ${enabled ? 'enabled' : 'disabled'} successfully`,
    })
  } catch (error) {
    reply.code(404).send({ error: `Integration ${type} not found` })
  }
}

/**
 * POST /api/integration/:type/test - Test integration connection
 */
export async function testIntegrationHandler(
  request: FastifyRequest<{
    Params: { type: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params

  try {
    const result = await IntegrationService.testIntegration(type as IntegrationType)

    reply.code(result.success ? 200 : 400).send({
      success: result.success,
      message: result.message,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test failed'
    reply.code(500).send({ success: false, message })
  }
}

/**
 * GET /api/integration/:type/logs - Get integration logs
 */
export async function getIntegrationLogsHandler(
  request: FastifyRequest<{
    Params: { type: string }
    Querystring: { limit?: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params
  const limit = request.query.limit ? parseInt(request.query.limit) : 100

  const logs = await IntegrationService.getIntegrationLogs(type as IntegrationType, limit)

  reply.code(200).send({
    type,
    logs,
    count: logs.length,
  })
}

/**
 * GET /api/integration/:type/stats - Get integration statistics
 */
export async function getIntegrationStatsHandler(
  request: FastifyRequest<{
    Params: { type: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { type } = request.params

  const stats = await IntegrationService.getIntegrationStats(type as IntegrationType)

  if (!stats) {
    reply.code(404).send({ error: `Integration ${type} not found` })
    return
  }

  reply.code(200).send({
    type,
    stats,
  })
}

/**
 * GET /api/alert - List all alerts
 */
export async function listAlertsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const alerts = await AlertService.listAlerts()

  reply.code(200).send(alerts)
}

/**
 * POST /api/alert - Create alert configuration
 */
export async function createAlertHandler(
  request: FastifyRequest<{
    Body: AlertConfig
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const alert = await AlertService.createAlert(request.body)

    reply.code(201).send(alert)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create alert'
    reply.code(400).send({ error: message })
  }
}

/**
 * GET /api/alert/:id - Get alert by ID
 */
export async function getAlertHandler(
  request: FastifyRequest<{
    Params: { id: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params
  const alert = await AlertService.getAlert(parseInt(id))

  if (!alert) {
    reply.code(404).send({ error: 'Alert not found' })
    return
  }

  reply.code(200).send(alert)
}

/**
 * PUT /api/alert/:id - Update alert configuration
 */
export async function updateAlertHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: Partial<AlertConfig>
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params
    const alert = await AlertService.updateAlert(parseInt(id), request.body)

    reply.code(200).send(alert)
  } catch (error) {
    reply.code(404).send({ error: 'Alert not found' })
  }
}

/**
 * DELETE /api/alert/:id - Delete alert
 */
export async function deleteAlertHandler(
  request: FastifyRequest<{
    Params: { id: string }
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params
    await AlertService.deleteAlert(parseInt(id))

    reply.code(200).send({ message: 'Alert deleted successfully' })
  } catch (error) {
    reply.code(404).send({ error: 'Alert not found' })
  }
}

/**
 * PUT /api/alert/:id/toggle - Enable/disable alert
 */
export async function toggleAlertHandler(
  request: FastifyRequest<{
    Params: { id: string }
    Body: { enabled: boolean }
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params
    const { enabled } = request.body

    const alert = await AlertService.toggleAlert(parseInt(id), enabled)

    reply.code(200).send({
      ...alert,
      message: `Alert ${enabled ? 'enabled' : 'disabled'} successfully`,
    })
  } catch (error) {
    reply.code(404).send({ error: 'Alert not found' })
  }
}

export default {
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
}
