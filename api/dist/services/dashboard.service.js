"use strict";
/**
 * Dashboard Service - Real-time dashboard data and alerts
 * Provides current status, alerts, and active threat information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSensorStatuses = getSensorStatuses;
exports.getActiveThreats = getActiveThreats;
exports.getDashboardSummary = getDashboardSummary;
exports.getSensorHealth = getSensorHealth;
exports.getAttackTrends = getAttackTrends;
exports.getAlerts = getAlerts;
exports.getRiskLevel = getRiskLevel;
const prisma_1 = require("../lib/prisma");
const mongodb_1 = require("../lib/mongodb");
/**
 * Get all sensor statuses for dashboard
 */
async function getSensorStatuses() {
    const sensors = await prisma_1.prisma.sensor.findMany({
        select: {
            id: true,
            uuid: true,
            name: true,
            honeypot: true,
            ip: true,
            updatedAt: true,
            attacks: {
                select: { timestamp: true },
            },
        },
    });
    const now = new Date();
    const heartbeatThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes
    return sensors.map(sensor => {
        // Determine status based on last update
        let status;
        if (sensor.updatedAt > heartbeatThreshold) {
            status = 'online';
        }
        else if (sensor.updatedAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            status = 'idle';
        }
        else {
            status = 'offline';
        }
        // Count attacks in last 24 hours
        const attack24hTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const activeAttacks24h = sensor.attacks.filter(a => a.timestamp > attack24hTime).length;
        return {
            id: sensor.id,
            uuid: sensor.uuid,
            name: sensor.name,
            honeypot: sensor.honeypot,
            status,
            lastHeartbeat: sensor.updatedAt,
            activeAttacks24h,
            totalAttacks: sensor.attacks.length,
            ipAddress: sensor.ip,
        };
    });
}
/**
 * Get active/recent threats
 */
async function getActiveThreats(limitHours = 1, limit = 100) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const cutoffTime = new Date(Date.now() - limitHours * 60 * 60 * 1000);
    const events = await db
        .collection('attack_events')
        .find({ timestamp: { $gte: cutoffTime } })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    // Enrich with sensor and PostgreSQL data
    const threatIds = new Set();
    const threats = [];
    for (const event of events) {
        const threatId = `${event.sourceIp}-${event.targetPort}-${event.timestamp}`;
        if (threatIds.has(threatId))
            continue;
        threatIds.add(threatId);
        // Get sensor info from PostgreSQL
        const attack = await prisma_1.prisma.attack.findFirst({
            where: {
                sourceIp: event.sourceIp,
                timestamp: {
                    gte: new Date(event.timestamp.getTime() - 5000),
                    lte: new Date(event.timestamp.getTime() + 5000),
                },
            },
            include: {
                sensor: true,
            },
        });
        // Determine severity
        let severity = 'low';
        if (event.port === 22 || event.port === 23)
            severity = 'high'; // SSH/Telnet
        if (event.port === 445 || event.port === 3389)
            severity = 'medium'; // SMB/RDP
        if (event.protocol === 'SYN' && event.count > 100)
            severity = 'critical'; // DDoS indicator
        threats.push({
            id: threatId,
            sourceIp: event.sourceIp,
            targetPort: event.targetPort || event.port,
            protocol: event.protocol || 'unknown',
            timestamp: event.timestamp,
            sensorUuid: attack?.sensor.uuid || 'unknown',
            sensorName: attack?.sensor.name || 'unknown',
            severity,
            description: `${event.protocol || 'Attack'} attack from ${event.sourceIp} to port ${event.targetPort || 'unknown'}`,
        });
    }
    return threats;
}
/**
 * Get dashboard summary
 */
async function getDashboardSummary() {
    const now = new Date();
    const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Get sensor counts
    const [totalSensors, sensors, attacks24h] = await Promise.all([
        prisma_1.prisma.sensor.count(),
        prisma_1.prisma.sensor.findMany({
            select: {
                updatedAt: true,
                attacks: {
                    where: { timestamp: { gte: day24hAgo } },
                    select: { sourceIp: true, protocol: true },
                },
            },
        }),
        prisma_1.prisma.attack.count({
            where: { timestamp: { gte: day24hAgo } },
        }),
    ]);
    const heartbeatThreshold = new Date(now.getTime() - 5 * 60 * 1000);
    const activeSensors = sensors.filter(s => s.updatedAt > heartbeatThreshold).length;
    const offlineSensors = totalSensors - activeSensors;
    // Get unique attackers
    const uniqueAttackers24h = new Set();
    const protocolCounts = new Map();
    sensors.forEach(sensor => {
        sensor.attacks.forEach(attack => {
            uniqueAttackers24h.add(attack.sourceIp);
            const count = protocolCounts.get(attack.protocol) || 0;
            protocolCounts.set(attack.protocol, count + 1);
        });
    });
    // Find top protocol
    const topProtocol = Array.from(protocolCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    // Get active threats
    const activeThreats = await getActiveThreats(1);
    // Get top attacker
    const topAttackerData = await prisma_1.prisma.attack.groupBy({
        by: ['sourceIp'],
        where: { timestamp: { gte: day24hAgo } },
        _count: { sourceIp: true },
        orderBy: { _count: { sourceIp: 'desc' } },
        take: 1,
    });
    return {
        totalSensors,
        activeSensors,
        offlineSensors,
        attacks24h,
        uniqueAttackers24h: uniqueAttackers24h.size,
        activeThreats: activeThreats.length,
        topAttackingIp: topAttackerData[0]?.sourceIp,
        topAttackProtocol: topProtocol,
    };
}
/**
 * Get sensor health metrics
 */
async function getSensorHealth(sensorId) {
    const sensor = await prisma_1.prisma.sensor.findUnique({
        where: { id: sensorId },
        select: {
            updatedAt: true,
            createdAt: true,
        },
    });
    if (!sensor) {
        throw new Error(`Sensor ${sensorId} not found`);
    }
    const now = new Date();
    const lifespan = now.getTime() - sensor.createdAt.getTime();
    const uptime = Math.min(100, (lifespan - 0) / lifespan * 100); // Simplified calculation
    return {
        sensorId,
        uptime,
        avgResponseTime: 0, // Would be populated from actual response time tracking
        lastHeartbeat: sensor.updatedAt,
        isHealthy: now.getTime() - sensor.updatedAt.getTime() < 5 * 60 * 1000,
    };
}
/**
 * Get attack trends (last N hours)
 */
async function getAttackTrends(hours = 24) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const pipeline = [
        {
            $match: {
                timestamp: { $gte: cutoffTime },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d %H:00:00',
                        date: '$timestamp',
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ];
    const results = await db.collection('attack_events').aggregate(pipeline).toArray();
    return results.map((r) => ({
        timestamp: r._id,
        count: r.count,
    }));
}
/**
 * Get alerts that should be raised (unusual activity detection)
 */
async function getAlerts() {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const alerts = [];
    const now = new Date();
    const hour1 = new Date(now.getTime() - 60 * 60 * 1000);
    // Check for DDoS patterns (many attacks from same IP in short time)
    const ddosPattern = await db
        .collection('attack_events')
        .aggregate([
        {
            $match: {
                timestamp: { $gte: hour1 },
            },
        },
        {
            $group: {
                _id: '$sourceIp',
                count: { $sum: 1 },
            },
        },
        {
            $match: {
                count: { $gte: 100 }, // More than 100 attacks in 1 hour
            },
        },
    ])
        .toArray();
    if (ddosPattern.length > 0) {
        ddosPattern.forEach((pattern) => {
            alerts.push({
                type: 'DDoS_PATTERN',
                severity: 'critical',
                message: `Potential DDoS from ${pattern._id} (${pattern.count} attacks in 1 hour)`,
                timestamp: now,
                sourceIp: pattern._id,
            });
        });
    }
    // Check for port scanning patterns
    const portScanPattern = await db
        .collection('attack_events')
        .aggregate([
        {
            $match: {
                timestamp: { $gte: hour1 },
            },
        },
        {
            $group: {
                _id: '$sourceIp',
                uniquePorts: { $addToSet: '$port' },
                count: { $sum: 1 },
            },
        },
        {
            $match: {
                $expr: {
                    $gte: [{ $size: '$uniquePorts' }, 10], // 10+ different ports from same IP
                },
            },
        },
    ])
        .toArray();
    if (portScanPattern.length > 0) {
        portScanPattern.forEach((pattern) => {
            alerts.push({
                type: 'PORT_SCAN',
                severity: 'high',
                message: `Port scanning detected from ${pattern._id} (${pattern.uniquePorts.length} unique ports)`,
                timestamp: now,
                sourceIp: pattern._id,
            });
        });
    }
    return alerts;
}
/**
 * Get current network risk level
 */
async function getRiskLevel() {
    const now = new Date();
    const hour1 = new Date(now.getTime() - 60 * 60 * 1000);
    const attacks24h = await prisma_1.prisma.attack.count({
        where: {
            timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
    });
    const attacks1h = await prisma_1.prisma.attack.count({
        where: {
            timestamp: { gte: hour1 },
        },
    });
    // Simple risk calculation
    if (attacks1h > 1000)
        return 'critical';
    if (attacks1h > 500)
        return 'high';
    if (attacks24h > 10000)
        return 'high';
    if (attacks24h > 5000)
        return 'medium';
    return 'low';
}
