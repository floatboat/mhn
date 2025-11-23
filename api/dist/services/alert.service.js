"use strict";
/**
 * Alert Service
 * Manages alert configuration and detection logic for security events
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlert = createAlert;
exports.getAlert = getAlert;
exports.getAlertByType = getAlertByType;
exports.listAlerts = listAlerts;
exports.listEnabledAlerts = listEnabledAlerts;
exports.updateAlert = updateAlert;
exports.deleteAlert = deleteAlert;
exports.toggleAlert = toggleAlert;
exports.checkDDoSAlert = checkDDoSAlert;
exports.checkPortScanAlert = checkPortScanAlert;
exports.checkHighSeverityAlert = checkHighSeverityAlert;
exports.triggerAlert = triggerAlert;
exports.checkAllAlerts = checkAllAlerts;
const prisma_1 = __importDefault(require("../lib/prisma"));
const email_notification_service_1 = __importDefault(require("./email-notification.service"));
const integration_service_1 = __importDefault(require("./integration.service"));
/**
 * Create alert configuration
 */
async function createAlert(config) {
    return prisma_1.default.alert.create({
        data: {
            type: config.type,
            name: config.name || `${config.type} Alert`,
            description: config.description,
            threshold: config.threshold,
            timeWindow: config.timeWindow,
            sendEmail: config.sendEmail || false,
            emailAddresses: config.emailAddresses ? JSON.stringify(config.emailAddresses) : null,
        },
    });
}
/**
 * Get alert by ID
 */
async function getAlert(id) {
    return prisma_1.default.alert.findUnique({
        where: { id },
    });
}
/**
 * Get alert by type
 */
async function getAlertByType(type) {
    return prisma_1.default.alert.findFirst({
        where: { type },
    });
}
/**
 * List all alerts
 */
async function listAlerts() {
    return prisma_1.default.alert.findMany({
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * List enabled alerts
 */
async function listEnabledAlerts() {
    return prisma_1.default.alert.findMany({
        where: { enabled: true },
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Update alert configuration
 */
async function updateAlert(id, config) {
    return prisma_1.default.alert.update({
        where: { id },
        data: {
            ...(config.name && { name: config.name }),
            ...(config.description && { description: config.description }),
            ...(config.threshold && { threshold: config.threshold }),
            ...(config.timeWindow && { timeWindow: config.timeWindow }),
            ...(config.sendEmail !== undefined && { sendEmail: config.sendEmail }),
            ...(config.emailAddresses && { emailAddresses: JSON.stringify(config.emailAddresses) }),
        },
    });
}
/**
 * Delete alert
 */
async function deleteAlert(id) {
    return prisma_1.default.alert.delete({
        where: { id },
    });
}
/**
 * Enable/disable alert
 */
async function toggleAlert(id, enabled) {
    return prisma_1.default.alert.update({
        where: { id },
        data: { enabled },
    });
}
/**
 * Check DDoS alert condition
 * Triggers if >threshold attacks from same IP within timeWindow
 */
async function checkDDoSAlert() {
    const alert = await getAlertByType('ddos');
    if (!alert || !alert.enabled) {
        return false;
    }
    const now = new Date();
    const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000);
    // Find IPs with attack count > threshold
    const result = await prisma_1.default.attack.groupBy({
        by: ['sourceIp'],
        where: {
            timestamp: {
                gte: timeWindowStart,
                lte: now,
            },
        },
        _count: true,
    });
    const suspicious = result.filter((r) => r._count >= alert.threshold);
    if (suspicious.length > 0) {
        await triggerAlert(alert.id, 'ddos', {
            suspiciousIps: suspicious.map((r) => ({
                ip: r.sourceIp,
                attackCount: r._count,
            })),
            timeWindow: alert.timeWindow,
        });
        return true;
    }
    return false;
}
/**
 * Check port scan alert condition
 * Triggers if >threshold unique ports scanned from same IP within timeWindow
 */
async function checkPortScanAlert() {
    const alert = await getAlertByType('port_scan');
    if (!alert || !alert.enabled) {
        return false;
    }
    const now = new Date();
    const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000);
    // Find IPs scanning multiple ports
    const result = await prisma_1.default.attack.groupBy({
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
    });
    const suspicious = result.filter((r) => r._count.port >= alert.threshold);
    if (suspicious.length > 0) {
        await triggerAlert(alert.id, 'port_scan', {
            suspiciousIps: suspicious.map((r) => ({
                ip: r.sourceIp,
                uniquePorts: r._count.port,
            })),
            timeWindow: alert.timeWindow,
        });
        return true;
    }
    return false;
}
/**
 * Check high severity alert condition
 * Triggers if >threshold attacks from high-severity honeypots within timeWindow
 */
async function checkHighSeverityAlert() {
    const alert = await getAlertByType('high_severity');
    if (!alert || !alert.enabled) {
        return false;
    }
    const now = new Date();
    const timeWindowStart = new Date(now.getTime() - alert.timeWindow * 1000);
    // High severity honeypot types (e.g., database, SSH, RDP)
    const highSeverityTypes = ['mysql', 'postgres', 'ssh', 'rdp', 'redis'];
    const attacks = await prisma_1.default.attack.count({
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
    });
    if (attacks >= alert.threshold) {
        await triggerAlert(alert.id, 'high_severity', {
            attackCount: attacks,
            honeypotTypes: highSeverityTypes,
            timeWindow: alert.timeWindow,
        });
        return true;
    }
    return false;
}
/**
 * Trigger alert and send notifications
 */
async function triggerAlert(alertId, alertType, details) {
    const alert = await getAlert(alertId);
    if (!alert) {
        return;
    }
    // Update alert last triggered time and count
    await prisma_1.default.alert.update({
        where: { id: alertId },
        data: {
            lastTriggeredAt: new Date(),
            triggerCount: {
                increment: 1,
            },
        },
    });
    // Send email if configured
    if (alert.sendEmail && alert.emailAddresses) {
        const emailAddresses = JSON.parse(alert.emailAddresses);
        const emailConfig = await integration_service_1.default.getIntegration('email');
        if (emailConfig) {
            const emailService = new email_notification_service_1.default(emailConfig.config);
            const message = formatAlertMessage(alertType, details);
            for (const email of emailAddresses) {
                try {
                    await emailService.sendSecurityAlert(email, alertType, message);
                }
                catch (error) {
                    console.error(`Failed to send alert email to ${email}:`, error);
                }
            }
        }
    }
    // Log alert trigger
    await integration_service_1.default.logIntegrationEvent('email', 'alert', 'success', undefined, {
        alertType,
        details,
    });
}
/**
 * Format alert message for notifications
 */
function formatAlertMessage(alertType, details) {
    switch (alertType) {
        case 'ddos':
            return `DDoS Alert: Detected ${details.suspiciousIps.length} suspicious IPs with attacks exceeding threshold within ${details.timeWindow}s window`;
        case 'port_scan':
            return `Port Scan Alert: Detected ${details.suspiciousIps.length} IPs scanning multiple ports within ${details.timeWindow}s window`;
        case 'high_severity':
            return `High Severity Alert: Detected ${details.attackCount} attacks on critical services (${details.honeypotTypes.join(', ')}) within ${details.timeWindow}s window`;
        default:
            return `Alert: ${alertType} triggered with details: ${JSON.stringify(details)}`;
    }
}
/**
 * Run all alert checks
 */
async function checkAllAlerts() {
    await Promise.all([checkDDoSAlert(), checkPortScanAlert(), checkHighSeverityAlert()]);
}
exports.default = {
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
};
