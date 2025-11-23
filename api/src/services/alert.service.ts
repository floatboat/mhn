/**
 * Alert Service
 * Manages alert configuration and detection logic for security events
 */

import { prisma } from '../lib/prisma'
import { Alert } from '@prisma/client'
import { EmailNotificationService } from './email-notification.service'
import IntegrationService from './integration.service'

export interface AlertConfig {
  type: 'ddos' | 'port_scan' | 'high_severity' | 'custom'
  name?: string
  description?: string
  threshold: number
  timeWindow: number // in seconds
  sendEmail?: boolean
  emailAddresses?: string[]
}

/**
 * Create alert configuration
 */
export async function createAlert(config: AlertConfig): Promise<Alert> {
  return prisma.alert.create({
    data: {
      type: config.type,
      name: config.name || `${config.type} Alert`,
      description: config.description,
      threshold: config.threshold,
      timeWindow: config.timeWindow,
      sendEmail: config.sendEmail || false,
      emailAddresses: config.emailAddresses ? JSON.stringify(config.emailAddresses) : null,
    },
  })
}

/**
 * Get alert by ID
 */
export async function getAlert(id: number): Promise<Alert | null> {
  return prisma.alert.findUnique({
    where: { id },
  })
}

/**
 * Get alert by type
 */
export async function getAlertByType(type: string): Promise<Alert | null> {
  return prisma.alert.findFirst({
    where: { type },
  })
}

/**
 * List all alerts
 */
export async function listAlerts(): Promise<Alert[]> {
  return prisma.alert.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * List enabled alerts
 */
export async function listEnabledAlerts(): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Update alert configuration
 */
export async function updateAlert(id: number, config: Partial<AlertConfig>): Promise<Alert> {
  return prisma.alert.update({
    where: { id },
    data: {
      ...(config.name && { name: config.name }),
      ...(config.description && { description: config.description }),
      ...(config.threshold && { threshold: config.threshold }),
      ...(config.timeWindow && { timeWindow: config.timeWindow }),
      ...(config.sendEmail !== undefined && { sendEmail: config.sendEmail }),
      ...(config.emailAddresses && { emailAddresses: JSON.stringify(config.emailAddresses) }),
    },
  })
}

/**
 * Delete alert
 */
export async function deleteAlert(id: number): Promise<Alert> {
  return prisma.alert.delete({
    where: { id },
  })
}

/**
 * Enable/disable alert
 */
export async function toggleAlert(id: number, enabled: boolean): Promise<Alert> {
  return prisma.alert.update({
    where: { id },
    data: { enabled },
  })
}

/**
 * Check DDoS alert condition
 * Triggers if >threshold attacks from same IP within timeWindow
 */
export async function checkDDoSAlert(): Promise<boolean> {
  const alert = await getAlertByType('ddos')
  if (!alert || !alert.enabled) {
    return false
  }

  const now = new Date()
  const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000)

  // Find IPs with attack count > threshold
  const result = await prisma.attack.groupBy({
    by: ['sourceIp'],
    where: {
      timestamp: {
        gte: timeWindowStart,
        lte: now,
      },
    },
    _count: true,
  })

  const suspicious = result.filter((r) => r._count >= alert.threshold)

  if (suspicious.length > 0) {
    await triggerAlert(alert.id, 'ddos', {
      suspiciousIps: suspicious.map((r) => ({
        ip: r.sourceIp,
        attackCount: r._count,
      })),
      timeWindow: alert.timeWindow,
    })
    return true
  }

  return false
}

/**
 * Check port scan alert condition
 * Triggers if >threshold unique ports scanned from same IP within timeWindow
 */
export async function checkPortScanAlert(): Promise<boolean> {
  const alert = await getAlertByType('port_scan')
  if (!alert || !alert.enabled) {
    return false
  }

  const now = new Date()
  const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000)

  // Find IPs scanning multiple ports
  const result = await prisma.attack.groupBy({
    by: ['sourceIp'],
    where: {
      timestamp: {
        gte: timeWindowStart,
        lte: now,
      },
      port: {
        not: null,
      },
    },
    _count: {
      port: true,
    },
  })

  const suspicious = result.filter((r) => r._count.port >= alert.threshold)

  if (suspicious.length > 0) {
    await triggerAlert(alert.id, 'port_scan', {
      suspiciousIps: suspicious.map((r) => ({
        ip: r.sourceIp,
        uniquePorts: r._count.port,
      })),
      timeWindow: alert.timeWindow,
    })
    return true
  }

  return false
}

/**
 * Check high severity alert condition
 * Triggers if >threshold attacks from high-severity honeypots within timeWindow
 */
export async function checkHighSeverityAlert(): Promise<boolean> {
  const alert = await getAlertByType('high_severity')
  if (!alert || !alert.enabled) {
    return false
  }

  const now = new Date()
  const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000)

  // High severity honeypot types (e.g., database, SSH, RDP)
  const highSeverityTypes = ['mysql', 'postgres', 'ssh', 'rdp', 'redis']

  const attacks = await prisma.attack.count({
    where: {
      timestamp: {
        gte: timeWindowStart,
        lte: now,
      },
      sensor: {
        honeypot: {
          in: highSeverityTypes,
        },
      },
    },
  })

  if (attacks >= alert.threshold) {
    await triggerAlert(alert.id, 'high_severity', {
      attackCount: attacks,
      honeypotTypes: highSeverityTypes,
      timeWindow: alert.timeWindow,
    })
    return true
  }

  return false
}

/**
 * Trigger alert and send notifications
 */
export async function triggerAlert(
  alertId: number,
  alertType: string,
  details: any
): Promise<void> {
  const alert = await getAlert(alertId)
  if (!alert) {
    return
  }

  // Update alert last triggered time and count
  await prisma.alert.update({
    where: { id: alertId },
    data: {
      lastTriggeredAt: new Date(),
      triggerCount: {
        increment: 1,
      },
    },
  })

  // Send email if configured
  if (alert.sendEmail && alert.emailAddresses) {
    const emailAddresses = JSON.parse(alert.emailAddresses) as string[]
    const emailConfig = await IntegrationService.getIntegration('email')

    if (emailConfig) {
      const emailService = new EmailNotificationService(emailConfig.config)
      const message = formatAlertMessage(alertType, details)

      for (const email of emailAddresses) {
        try {
          await emailService.sendSecurityAlert(email, alertType, message)
        } catch (error) {
          console.error(`Failed to send alert email to ${email}:`, error)
        }
      }
    }
  }

  // Log alert trigger
  await IntegrationService.logIntegrationEvent('email', 'alert', 'success', undefined, {
    alertType,
    details,
  })
}

/**
 * Format alert message for notifications
 */
function formatAlertMessage(alertType: string, details: any): string {
  switch (alertType) {
    case 'ddos':
      return `DDoS Alert: Detected ${details.suspiciousIps.length} suspicious IPs with attacks exceeding threshold within ${details.timeWindow}s window`

    case 'port_scan':
      return `Port Scan Alert: Detected ${details.suspiciousIps.length} IPs scanning multiple ports within ${details.timeWindow}s window`

    case 'high_severity':
      return `High Severity Alert: Detected ${details.attackCount} attacks on critical services (${details.honeypotTypes.join(', ')}) within ${details.timeWindow}s window`

    default:
      return `Alert: ${alertType} triggered with details: ${JSON.stringify(details)}`
  }
}

/**
 * Run all alert checks
 */
export async function checkAllAlerts(): Promise<void> {
  await Promise.all([checkDDoSAlert(), checkPortScanAlert(), checkHighSeverityAlert()])
}

export default {
  createAlert,
  getAlert,
  getAlertByType,
  listAlerts,
  listEnabledAlerts,
  updateAlert,
  deleteAlert,
  toggleAlert,
  checkDDoSAlert,
  checkPortScanAlert,
  checkHighSeverityAlert,
  triggerAlert,
  checkAllAlerts,
}
