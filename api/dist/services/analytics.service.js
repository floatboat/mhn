"use strict";
/**
 * Analytics Service - Attack data aggregation and statistical analysis
 * Provides time-series data, trends, leaderboards, and geographic heatmaps
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttackStats = getAttackStats;
exports.getAttackTimeSeries = getAttackTimeSeries;
exports.getProtocolDistribution = getProtocolDistribution;
exports.getTopAttackers = getTopAttackers;
exports.getGeoHeatmap = getGeoHeatmap;
exports.getSensorStats = getSensorStats;
exports.getAttacksByCountry = getAttacksByCountry;
exports.getHourlyFrequency = getHourlyFrequency;
exports.getTopTargetPorts = getTopTargetPorts;
const mongodb_1 = require("../lib/mongodb");
const prisma_1 = require("../lib/prisma");
/**
 * Get overall attack statistics
 */
async function getAttackStats(startTime, endTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const query = {};
    if (startTime || endTime) {
        query.timestamp = {};
        if (startTime)
            query.timestamp.$gte = startTime;
        if (endTime)
            query.timestamp.$lte = endTime;
    }
    const [totalAttacks, uniqueAttackers, uniqueTargets] = await Promise.all([
        db.collection('attack_events').countDocuments(query),
        db.collection('attack_events').distinct('sourceIp', query).then(ips => ips.length),
        db.collection('attack_events').distinct('targetPort', query).then(ports => ports.length),
    ]);
    // Calculate daily average if we have a time range
    let avgAttacksPerHour = 0;
    let avgAttacksPerDay = 0;
    if (startTime && endTime) {
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        avgAttacksPerHour = totalAttacks / Math.max(hours, 1);
        avgAttacksPerDay = totalAttacks / Math.max(hours / 24, 1);
    }
    return {
        totalAttacks,
        uniqueAttackers,
        uniqueTargets,
        avgAttacksPerHour,
        avgAttacksPerDay,
    };
}
/**
 * Get time series aggregation of attacks
 */
async function getAttackTimeSeries(period = 'daily', limit = 30, startTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    // Determine grouping interval based on period
    let groupUnit;
    switch (period) {
        case 'hourly':
            groupUnit = '%Y-%m-%d %H:00:00';
            break;
        case 'daily':
            groupUnit = '%Y-%m-%d';
            break;
        case 'weekly':
            groupUnit = '%Y-W%V';
            break;
        case 'monthly':
            groupUnit = '%Y-%m';
            break;
    }
    const matchStage = {};
    if (startTime) {
        matchStage.timestamp = { $gte: startTime };
    }
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: groupUnit,
                        date: '$timestamp',
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        { $limit: limit },
    ];
    const results = await db.collection('attack_events').aggregate(pipeline).toArray();
    return results.map((r) => ({
        timestamp: r._id,
        count: r.count,
        period,
    }));
}
/**
 * Get protocol distribution
 */
async function getProtocolDistribution(startTime, endTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const matchStage = {};
    if (startTime || endTime) {
        matchStage.timestamp = {};
        if (startTime)
            matchStage.timestamp.$gte = startTime;
        if (endTime)
            matchStage.timestamp.$lte = endTime;
    }
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: '$protocol',
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ];
    const results = await db.collection('attack_events').aggregate(pipeline).toArray();
    // Calculate percentages
    const total = results.reduce((sum, r) => sum + r.count, 0);
    return results.map((r) => ({
        protocol: r._id || 'unknown',
        count: r.count,
        percentage: (r.count / total) * 100,
    }));
}
/**
 * Get top attacking IPs
 */
async function getTopAttackers(limit = 10, startTime, endTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const matchStage = {};
    if (startTime || endTime) {
        matchStage.timestamp = {};
        if (startTime)
            matchStage.timestamp.$gte = startTime;
        if (endTime)
            matchStage.timestamp.$lte = endTime;
    }
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: '$sourceIp',
                attackCount: { $sum: 1 },
                lastSeen: { $max: '$timestamp' },
                uniqueTargets: { $addToSet: '$targetPort' },
            },
        },
        {
            $project: {
                sourceIp: '$_id',
                attackCount: 1,
                lastSeen: 1,
                uniqueTargets: { $size: '$uniqueTargets' },
                _id: 0,
            },
        },
        { $sort: { attackCount: -1 } },
        { $limit: limit },
    ];
    const results = await db.collection('attack_events').aggregate(pipeline).toArray();
    return results;
}
/**
 * Get geographic heatmap data
 */
async function getGeoHeatmap(startTime, endTime) {
    // Get attacks from PostgreSQL with geolocation
    const attacks = await prisma_1.prisma.attack.findMany({
        where: {
            timestamp: {
                gte: startTime,
                lte: endTime,
            },
            country: {
                not: null,
            },
        },
        select: {
            sourceIp: true,
            country: true,
            latitude: true,
            longitude: true,
        },
    });
    // Aggregate by country
    const countryMap = new Map();
    attacks.forEach(attack => {
        const country = attack.country || 'unknown';
        if (!countryMap.has(country)) {
            countryMap.set(country, { ips: new Set(), count: 0 });
        }
        const entry = countryMap.get(country);
        entry.ips.add(attack.sourceIp);
        entry.count++;
    });
    // Convert to result format
    const results = [];
    countryMap.forEach((value, country) => {
        const sampleAttack = attacks.find(a => a.country === country);
        results.push({
            country,
            attackCount: value.count,
            uniqueIps: value.ips.size,
            latitude: sampleAttack?.latitude || undefined,
            longitude: sampleAttack?.longitude || undefined,
        });
    });
    return results.sort((a, b) => b.attackCount - a.attackCount);
}
/**
 * Get attack statistics per sensor
 */
async function getSensorStats(startTime, endTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    // Get all sensors with attack counts
    const sensors = await prisma_1.prisma.sensor.findMany({
        select: {
            id: true,
            uuid: true,
            name: true,
            attacks: {
                where: {
                    timestamp: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
                select: {
                    sourceIp: true,
                    protocol: true,
                    timestamp: true,
                },
            },
        },
    });
    return sensors.map(sensor => {
        const protocols = new Map();
        const uniqueAttackers = new Set();
        sensor.attacks.forEach(attack => {
            uniqueAttackers.add(attack.sourceIp);
            const protocol = attack.protocol || 'unknown';
            protocols.set(protocol, (protocols.get(protocol) || 0) + 1);
        });
        // Get primary protocol (most common)
        const primaryProtocol = Array.from(protocols.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
        // Get last attack time
        const lastAttack = sensor.attacks.length > 0
            ? sensor.attacks.reduce((latest, current) => current.timestamp > latest.timestamp ? current : latest)
            : null;
        return {
            sensorId: sensor.id,
            sensorName: sensor.name,
            sensorUuid: sensor.uuid,
            totalAttacks: sensor.attacks.length,
            uniqueAttackers: uniqueAttackers.size,
            lastAttackTime: lastAttack?.timestamp,
            primaryProtocol,
        };
    });
}
/**
 * Get attack count by country code
 */
async function getAttacksByCountry(limit = 50, startTime, endTime) {
    const attacks = await prisma_1.prisma.attack.groupBy({
        by: ['country'],
        where: {
            country: { not: null },
            timestamp: {
                gte: startTime,
                lte: endTime,
            },
        },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: limit,
    });
    return attacks
        .filter(a => a.country)
        .map(a => ({
        country: a.country,
        count: a._count.country,
    }));
}
/**
 * Get attack frequency analysis (attacks per hour of day)
 */
async function getHourlyFrequency(startTime, endTime) {
    const db = (0, mongodb_1.getMongoDB)();
    if (!db) {
        throw new Error('MongoDB connection not available');
    }
    const matchStage = {};
    if (startTime || endTime) {
        matchStage.timestamp = {};
        if (startTime)
            matchStage.timestamp.$gte = startTime;
        if (endTime)
            matchStage.timestamp.$lte = endTime;
    }
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: {
                    $hour: '$timestamp',
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ];
    const results = await db.collection('attack_events').aggregate(pipeline).toArray();
    // Fill missing hours with 0
    const hourlyData = Array(24)
        .fill(0)
        .map((_, hour) => {
        const found = results.find((r) => r._id === hour);
        return {
            hour,
            count: found?.count || 0,
        };
    });
    return hourlyData;
}
/**
 * Get port scan patterns
 */
async function getTopTargetPorts(limit = 20, startTime, endTime) {
    const attacks = await prisma_1.prisma.attack.groupBy({
        by: ['port'],
        where: {
            port: { not: null },
            timestamp: {
                gte: startTime,
                lte: endTime,
            },
        },
        _count: { port: true },
        orderBy: { _count: { port: 'desc' } },
        take: limit,
    });
    return attacks
        .filter(a => a.port)
        .map(a => ({
        port: a.port,
        count: a._count.port,
    }));
}
