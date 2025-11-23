/**
 * Integration Service
 * Manages external system configurations (Splunk, ArcSight, Elasticsearch, HPFeeds, Email)
 */

import { prisma } from '../lib/prisma'
import { Integration, Prisma } from '@prisma/client'
import { EmailNotificationService } from './email-notification.service'
import SplunkForwarderService from './integrations/splunk-forwarder.service'
import ArcSightForwarderService from './integrations/arcsight-forwarder.service'
import ElasticsearchForwarderService from './integrations/elasticsearch-forwarder.service'
import HPFeedsLoggerService from './integrations/hpfeeds-logger.service'

export type IntegrationType = 'splunk' | 'arcsight' | 'elasticsearch' | 'hpfeeds' | 'email'

export interface IntegrationConfig {
  // Email
  provider?: 'smtp' | 'sendgrid' | 'mailgun'
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpPassword?: string
  sendgridApiKey?: string
  mailgunApiKey?: string
  mailgunDomain?: string
  fromEmail?: string

  // Splunk
  splunkHost?: string
  splunkPort?: number
  splunkToken?: string
  splunkIndex?: string
  verifySsl?: boolean

  // ArcSight
  arcsightHost?: string
  arcsightPort?: number
  arcsightProtocol?: 'udp' | 'tcp'

  // Elasticsearch
  elasticsearchHost?: string
  elasticsearchPort?: number
  elasticsearchUsername?: string
  elasticsearchPassword?: string
  elasticsearchIndex?: string
  verifySslEls?: boolean

  // HPFeeds
  hpfeedsHost?: string
  hpfeedsPort?: number
  hpfeedsIdentifier?: string
  hpfeedsSecret?: string
  hpfeedsChannel?: string
}

/**
 * Create a new integration configuration
 */
export async function createIntegration(
  type: IntegrationType,
  config: IntegrationConfig,
  name?: string
): Promise<Integration> {
  const existing = await prisma.integration.findUnique({
    where: { type },
  })

  if (existing) {
    throw new Error(`Integration of type ${type} already exists`)
  }

  return prisma.integration.create({
    data: {
      type,
      name: name || `${type} Integration`,
      config: config as Prisma.JsonObject,
      testStatus: 'untested',
    },
  })
}

/**
 * Get integration by type
 */
export async function getIntegration(type: IntegrationType): Promise<Integration | null> {
  return prisma.integration.findUnique({
    where: { type },
  })
}

/**
 * Get all integrations
 */
export async function listIntegrations(): Promise<Integration[]> {
  return prisma.integration.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get enabled integrations
 */
export async function listEnabledIntegrations(): Promise<Integration[]> {
  return prisma.integration.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Update integration configuration
 */
export async function updateIntegration(
  type: IntegrationType,
  config: IntegrationConfig,
  name?: string
): Promise<Integration> {
  return prisma.integration.update({
    where: { type },
    data: {
      config: config as Prisma.JsonObject,
      ...(name && { name }),
    },
  })
}

/**
 * Delete integration
 */
export async function deleteIntegration(type: IntegrationType): Promise<Integration> {
  return prisma.integration.delete({
    where: { type },
  })
}

/**
 * Enable/disable integration
 */
export async function toggleIntegration(type: IntegrationType, enabled: boolean): Promise<Integration> {
  return prisma.integration.update({
    where: { type },
    data: { enabled },
  })
}

/**
 * Test integration connection
 */
export async function testIntegration(type: IntegrationType): Promise<{
  success: boolean
  message: string
}> {
  const integration = await getIntegration(type)
  if (!integration) {
    throw new Error(`Integration ${type} not found`)
  }

  const config = integration.config as IntegrationConfig

  try {
    let success = false
    let message = ''

    switch (type) {
      case 'email':
        const emailService = new EmailNotificationService(config)
        await emailService.testConnection()
        success = true
        message = 'Email service connection successful'
        break

      case 'splunk':
        const splunkService = new SplunkForwarderService(config)
        await splunkService.testConnection()
        success = true
        message = 'Splunk HEC connection successful'
        break

      case 'arcsight':
        const arcsightService = new ArcSightForwarderService(config)
        await arcsightService.testConnection()
        success = true
        message = 'ArcSight connection successful'
        break

      case 'elasticsearch':
        const elasticService = new ElasticsearchForwarderService(config)
        await elasticService.testConnection()
        success = true
        message = 'Elasticsearch connection successful'
        break

      case 'hpfeeds':
        const hpfeedsService = new HPFeedsLoggerService(config)
        await hpfeedsService.testConnection()
        success = true
        message = 'HPFeeds connection successful'
        break

      default:
        message = `Unknown integration type: ${type}`
    }

    // Update test status
    await prisma.integration.update({
      where: { type },
      data: {
        testStatus: success ? 'success' : 'failed',
        testMessage: message,
        lastTestAt: new Date(),
      },
    })

    return { success, message }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update test status
    await prisma.integration.update({
      where: { type },
      data: {
        testStatus: 'failed',
        testMessage: errorMessage,
        lastTestAt: new Date(),
      },
    })

    return { success: false, message: errorMessage }
  }
}

/**
 * Log integration event
 */
export async function logIntegrationEvent(
  type: IntegrationType,
  eventType: string,
  status: 'success' | 'failed' | 'retrying',
  errorMessage?: string,
  eventData?: any,
  retryCount?: number
) {
  const integration = await getIntegration(type)
  if (!integration) {
    return
  }

  await prisma.integrationLog.create({
    data: {
      integrationId: integration.id,
      eventType,
      status,
      errorMessage,
      eventData: eventData as Prisma.JsonObject,
      retryCount: retryCount || 0,
    },
  })
}

/**
 * Get integration logs
 */
export async function getIntegrationLogs(
  type: IntegrationType,
  limit: number = 100
): Promise<any[]> {
  const integration = await getIntegration(type)
  if (!integration) {
    return []
  }

  return prisma.integrationLog.findMany({
    where: { integrationId: integration.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get integration statistics
 */
export async function getIntegrationStats(type: IntegrationType) {
  const integration = await getIntegration(type)
  if (!integration) {
    return null
  }

  const logs = await prisma.integrationLog.groupBy({
    by: ['status'],
    where: { integrationId: integration.id },
    _count: true,
  })

  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    retrying: 0,
  }

  logs.forEach((log) => {
    stats[log.status as keyof typeof stats] = log._count
    stats.total += log._count
  })

  return {
    ...stats,
    lastTestAt: integration.lastTestAt,
    testStatus: integration.testStatus,
  }
}

export default {
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
}
