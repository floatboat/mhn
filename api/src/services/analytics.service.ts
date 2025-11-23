/**
 * Analytics Service - Attack data aggregation and statistical analysis
 * Provides time-series data, trends, leaderboards, and geographic heatmaps
 */

import { mongodb } from '../lib/mongodb';
import { prisma } from '../lib/prisma';

/**
 * Time period for aggregation
 */
export type TimePeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Attack statistics
 */
export interface AttackStats {
  totalAttacks: number;
  uniqueAttackers: number;
  uniqueTargets: number;
  avgAttacksPerHour: number;
  avgAttacksPerDay: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string;
  count: number;
  period: TimePeriod;
}

/**
 * Protocol distribution
 */
export interface ProtocolStats {
  protocol: string;
  count: number;
  percentage: number;
}

/**
 * Top attacker entry
 */
export interface TopAttacker {
  sourceIp: string;
  attackCount: number;
  lastSeen: Date;
  uniqueTargets: number;
}

/**
 * Geographic heatmap entry
 */
export interface GeoHeatmapEntry {
  country: string;
  code?: string;
  attackCount: number;
  uniqueIps: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Sensor attack statistics
 */
export interface SensorStats {
  sensorId: number;
  sensorName: string;
  sensorUuid: string;
  totalAttacks: number;
  uniqueAttackers: number;
  lastAttackTime?: Date;
  primaryProtocol: string;
}

/**
 * Get overall attack statistics
 */
export async function getAttackStats(
  startTime?: Date,
  endTime?: Date,
): Promise<AttackStats> {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  const query: any = {};
  if (startTime || endTime) {
    query.timestamp = {};
    if (startTime) query.timestamp.$gte = startTime;
    if (endTime) query.timestamp.$lte = endTime;
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
export async function getAttackTimeSeries(
  period: TimePeriod = 'daily',
  limit = 30,
  startTime?: Date,
): Promise<TimeSeriesPoint[]> {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  // Determine grouping interval based on period
  let groupUnit: string;
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

  const matchStage: any = {};
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

  return results.map(r => ({
    timestamp: r._id,
    count: r.count,
    period,
  }));
}

/**
 * Get protocol distribution
 */
export async function getProtocolDistribution(
  startTime?: Date,
  endTime?: Date,
): Promise<ProtocolStats[]> {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  const matchStage: any = {};
  if (startTime || endTime) {
    matchStage.timestamp = {};
    if (startTime) matchStage.timestamp.$gte = startTime;
    if (endTime) matchStage.timestamp.$lte = endTime;
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
  return results.map(r => ({
    protocol: r._id || 'unknown',
    count: r.count,
    percentage: (r.count / total) * 100,
  }));
}

/**
 * Get top attacking IPs
 */
export async function getTopAttackers(
  limit = 10,
  startTime?: Date,
  endTime?: Date,
): Promise<TopAttacker[]> {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  const matchStage: any = {};
  if (startTime || endTime) {
    matchStage.timestamp = {};
    if (startTime) matchStage.timestamp.$gte = startTime;
    if (endTime) matchStage.timestamp.$lte = endTime;
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

  return results as TopAttacker[];
}

/**
 * Get geographic heatmap data
 */
export async function getGeoHeatmap(
  startTime?: Date,
  endTime?: Date,
): Promise<GeoHeatmapEntry[]> {
  // Get attacks from PostgreSQL with geolocation
  const attacks = await prisma.attack.findMany({
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
  const countryMap = new Map<string, { ips: Set<string>; count: number }>();

  attacks.forEach(attack => {
    const country = attack.country || 'unknown';
    if (!countryMap.has(country)) {
      countryMap.set(country, { ips: new Set(), count: 0 });
    }

    const entry = countryMap.get(country)!;
    entry.ips.add(attack.sourceIp);
    entry.count++;
  });

  // Convert to result format
  const results: GeoHeatmapEntry[] = [];
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
export async function getSensorStats(
  startTime?: Date,
  endTime?: Date,
): Promise<SensorStats[]> {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  // Get all sensors with attack counts
  const sensors = await prisma.sensor.findMany({
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
    const protocols = new Map<string, number>();
    const uniqueAttackers = new Set<string>();

    sensor.attacks.forEach(attack => {
      uniqueAttackers.add(attack.sourceIp);
      const protocol = attack.protocol || 'unknown';
      protocols.set(protocol, (protocols.get(protocol) || 0) + 1);
    });

    // Get primary protocol (most common)
    const primaryProtocol =
      Array.from(protocols.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Get last attack time
    const lastAttack = sensor.attacks.length > 0
      ? sensor.attacks.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest
        )
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
export async function getAttacksByCountry(
  limit = 50,
  startTime?: Date,
  endTime?: Date,
): Promise<Array<{ country: string; count: number }>> {
  const attacks = await prisma.attack.groupBy({
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
      country: a.country!,
      count: a._count.country,
    }));
}

/**
 * Get attack frequency analysis (attacks per hour of day)
 */
export async function getHourlyFrequency(startTime?: Date, endTime?: Date) {
  const db = mongodb.connection?.db('attacks');
  if (!db) {
    throw new Error('MongoDB connection not available');
  }

  const matchStage: any = {};
  if (startTime || endTime) {
    matchStage.timestamp = {};
    if (startTime) matchStage.timestamp.$gte = startTime;
    if (endTime) matchStage.timestamp.$lte = endTime;
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
      const found = results.find(r => r._id === hour);
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
export async function getTopTargetPorts(
  limit = 20,
  startTime?: Date,
  endTime?: Date,
): Promise<Array<{ port: number; count: number }>> {
  const attacks = await prisma.attack.groupBy({
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
      port: a.port!,
      count: a._count.port,
    }));
}
