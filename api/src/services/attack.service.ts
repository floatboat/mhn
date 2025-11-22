/**
 * Attack Data Service - Handles recording, querying, and analyzing attack events
 *
 * This service manages:
 * - Recording attack events from HPFeeds in MongoDB (detailed) and PostgreSQL (metadata)
 * - Querying and filtering attack data
 * - Generating statistics and analytics
 * - Geographic data aggregation
 * - Data retention and cleanup
 */

import { ObjectId } from 'mongodb';
import { prisma } from '../lib/prisma';
import { getMongoDB } from '../lib/mongodb';
import { Prisma } from '@prisma/client';

/**
 * Custom error for attack validation failures
 */
export class AttackValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'AttackValidationError';
  }
}

/**
 * Custom error for attack storage failures
 */
export class AttackStorageError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = 'AttackStorageError';
  }
}

/**
 * Custom error for sensor not found
 */
export class SensorNotFoundError extends Error {
  statusCode = 404;
  constructor(message: string = 'Sensor not found') {
    super(message);
    this.name = 'SensorNotFoundError';
  }
}

/**
 * Attack response interface (PostgreSQL metadata)
 */
export interface AttackResponse {
  id: number;
  sourceIp: string;
  protocol: string;
  port?: number | null;
  timestamp: Date;
  sensorId: number;
  mongoId?: string | null;
  country?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB attack event document structure
 */
export interface AttackEventDocument {
  sensorUuid: string;
  sourceIp: string;
  protocol: string;
  timestamp: Date;
  honeypotType: string;
  payload: Record<string, any>;
  port?: number;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Attack statistics response
 */
export interface AttackStatistics {
  totalAttacks: number;
  uniqueAttackers: number;
  topProtocols: Array<{ protocol: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  attacksByHoneypot: Array<{ honeypot: string; count: number }>;
  attacksBySensor: Array<{ sensorName: string; count: number }>;
  timeRange: { start: Date; end: Date };
}

/**
 * Top attacker information
 */
export interface TopAttacker {
  sourceIp: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  attackCount: number;
  protocols: string[];
  sensorsHit: string[];
}

/**
 * Geographic statistics for heatmap
 */
export interface GeoStatistics {
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  attackCount: number;
  uniqueIps: number;
}

/**
 * Filter options for querying attacks
 */
export interface AttackFilters {
  sensorId?: number;
  sourceIp?: string;
  protocol?: string;
  limit?: number;
  offset?: number;
}

/**
 * Validate IPv4 or IPv6 address format
 * @param ip - IP address string to validate
 * @returns True if valid IP address
 */
export function validateSourceIp(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  // IPv6 regex (simplified - covers most common cases)
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4})$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Validate protocol is in allowed list
 * @param protocol - Protocol string to validate
 * @returns True if valid protocol
 */
export function validateProtocol(protocol: string): boolean {
  const validProtocols = [
    'TCP',
    'UDP',
    'HTTP',
    'HTTPS',
    'SSH',
    'FTP',
    'SMTP',
    'DNS',
    'ICMP',
    'TELNET',
    'RDP',
    'SMB',
    'OTHER',
  ];
  return validProtocols.includes(protocol.toUpperCase());
}

/**
 * Validate port number is in valid range
 * @param port - Port number to validate
 * @returns True if valid port (1-65535)
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate geographic coordinates
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns True if coordinates are valid
 */
export function validateCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  );
}

/**
 * Record a new attack event from HPFeeds
 * Stores in both MongoDB (detailed payload) and PostgreSQL (metadata for fast queries)
 *
 * @param sensorUuid - UUID of the sensor that captured the attack
 * @param sourceIp - Source IP address of the attacker
 * @param protocol - Protocol used (TCP, UDP, HTTP, etc.)
 * @param mongoPayload - Full attack data payload to store in MongoDB
 * @param port - Optional target port number
 * @param country - Optional country code from geolocation
 * @param city - Optional city name from geolocation
 * @param latitude - Optional latitude coordinate
 * @param longitude - Optional longitude coordinate
 * @returns Object containing PostgreSQL attackId and MongoDB _id
 * @throws AttackValidationError if validation fails
 * @throws SensorNotFoundError if sensor doesn't exist
 * @throws AttackStorageError if database operation fails
 */
export async function recordAttackEvent(
  sensorUuid: string,
  sourceIp: string,
  protocol: string,
  mongoPayload: Record<string, any>,
  port?: number,
  country?: string,
  city?: string,
  latitude?: number,
  longitude?: number,
): Promise<{ attackId: number; mongoId: string }> {
  // Validate inputs
  if (!validateSourceIp(sourceIp)) {
    throw new AttackValidationError(`Invalid source IP address: ${sourceIp}`);
  }

  if (!validateProtocol(protocol)) {
    throw new AttackValidationError(
      `Invalid protocol: ${protocol}. Must be one of: TCP, UDP, HTTP, HTTPS, SSH, FTP, SMTP, DNS, ICMP, TELNET, RDP, SMB, OTHER`,
    );
  }

  if (port !== undefined && !validatePort(port)) {
    throw new AttackValidationError(
      `Invalid port number: ${port}. Must be between 1 and 65535`,
    );
  }

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    !validateCoordinates(latitude, longitude)
  ) {
    throw new AttackValidationError(
      `Invalid coordinates: lat=${latitude}, lng=${longitude}`,
    );
  }

  // Verify sensor exists and get sensor data
  const sensor = await prisma.sensor.findUnique({
    where: { uuid: sensorUuid },
  });

  if (!sensor) {
    throw new SensorNotFoundError(
      `Sensor with UUID ${sensorUuid} not found`,
    );
  }

  try {
    // Store detailed event in MongoDB
    const db = getMongoDB();
    const attackEvents = db.collection('attack_events');

    const mongoDoc: AttackEventDocument = {
      sensorUuid,
      sourceIp,
      protocol: protocol.toUpperCase(),
      timestamp: new Date(),
      honeypotType: sensor.honeypot,
      payload: mongoPayload,
      ...(port !== undefined && { port }),
      ...(country && { country }),
      ...(city && { city }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
    };

    const mongoResult = await attackEvents.insertOne(mongoDoc);
    const mongoId = mongoResult.insertedId.toString();

    // Store metadata in PostgreSQL for fast queries
    const attack = await prisma.attack.create({
      data: {
        sourceIp,
        protocol: protocol.toUpperCase(),
        sensorId: sensor.id,
        mongoId,
        ...(port !== undefined && { port }),
        ...(country && { country }),
        ...(city && { city }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
      },
    });

    return {
      attackId: attack.id,
      mongoId,
    };
  } catch (error) {
    throw new AttackStorageError(
      `Failed to store attack event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Get attacks by date range with optional filtering
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param filters - Optional filters (sensorId, sourceIp, protocol, limit, offset)
 * @returns Object with attacks array, total count, and filtered count
 */
export async function getAttacksByDateRange(
  startDate: Date,
  endDate: Date,
  filters?: AttackFilters,
): Promise<{
  attacks: AttackResponse[];
  total: number;
  filtered: number;
}> {
  // Build where clause
  const where: Prisma.AttackWhereInput = {
    timestamp: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (filters?.sensorId) {
    where.sensorId = filters.sensorId;
  }

  if (filters?.sourceIp) {
    where.sourceIp = filters.sourceIp;
  }

  if (filters?.protocol) {
    where.protocol = filters.protocol.toUpperCase();
  }

  // Get total count (all attacks in date range, no filters)
  const total = await prisma.attack.count({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get filtered count
  const filtered = await prisma.attack.count({ where });

  // Get paginated attacks
  const attacks = await prisma.attack.findMany({
    where,
    orderBy: {
      timestamp: 'desc',
    },
    skip: filters?.offset || 0,
    take: filters?.limit || 20,
  });

  return {
    attacks,
    total,
    filtered,
  };
}

/**
 * Get attack statistics for dashboard
 *
 * @param startDate - Optional start date for filtering (defaults to 30 days ago)
 * @param endDate - Optional end date for filtering (defaults to now)
 * @returns Attack statistics object
 */
export async function getAttackStatistics(
  startDate?: Date,
  endDate?: Date,
): Promise<AttackStatistics> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const end = endDate || new Date();

  const where: Prisma.AttackWhereInput = {
    timestamp: {
      gte: start,
      lte: end,
    },
  };

  // Total attacks
  const totalAttacks = await prisma.attack.count({ where });

  // Unique attackers (distinct source IPs)
  const uniqueAttackers = await prisma.attack.findMany({
    where,
    select: { sourceIp: true },
    distinct: ['sourceIp'],
  });

  // Top protocols
  const protocolCounts = await prisma.attack.groupBy({
    by: ['protocol'],
    where,
    _count: {
      protocol: true,
    },
    orderBy: {
      _count: {
        protocol: 'desc',
      },
    },
    take: 10,
  });

  const topProtocols = protocolCounts.map((p) => ({
    protocol: p.protocol,
    count: p._count.protocol,
  }));

  // Top countries
  const countryCounts = await prisma.attack.groupBy({
    by: ['country'],
    where: {
      ...where,
      country: { not: null },
    },
    _count: {
      country: true,
    },
    orderBy: {
      _count: {
        country: 'desc',
      },
    },
    take: 10,
  });

  const topCountries = countryCounts.map((c) => ({
    country: c.country || 'Unknown',
    count: c._count.country,
  }));

  // Attacks by honeypot type (join with Sensor)
  const honeypotCounts = await prisma.attack.groupBy({
    by: ['sensorId'],
    where,
    _count: {
      sensorId: true,
    },
  });

  const sensorsMap = new Map<string, number>();
  const sensorNames = new Map<number, string>();

  for (const hc of honeypotCounts) {
    const sensor = await prisma.sensor.findUnique({
      where: { id: hc.sensorId },
    });
    if (sensor) {
      sensorsMap.set(
        sensor.honeypot,
        (sensorsMap.get(sensor.honeypot) || 0) + hc._count.sensorId,
      );
      sensorNames.set(hc.sensorId, sensor.name);
    }
  }

  const attacksByHoneypot = Array.from(sensorsMap.entries())
    .map(([honeypot, count]) => ({ honeypot, count }))
    .sort((a, b) => b.count - a.count);

  // Attacks by sensor
  const attacksBySensor = honeypotCounts
    .map((sc) => ({
      sensorName: sensorNames.get(sc.sensorId) || `Sensor ${sc.sensorId}`,
      count: sc._count.sensorId,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalAttacks,
    uniqueAttackers: uniqueAttackers.length,
    topProtocols,
    topCountries,
    attacksByHoneypot,
    attacksBySensor,
    timeRange: { start, end },
  };
}

/**
 * Get top attackers (IP leaderboard)
 *
 * @param limit - Maximum number of attackers to return (default: 10)
 * @param startDate - Optional start date for filtering
 * @param endDate - Optional end date for filtering
 * @returns Array of top attacker information
 */
export async function getTopAttackers(
  limit: number = 10,
  startDate?: Date,
  endDate?: Date,
): Promise<TopAttacker[]> {
  const where: Prisma.AttackWhereInput = {};

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  // Group by source IP
  const ipCounts = await prisma.attack.groupBy({
    by: ['sourceIp'],
    where,
    _count: {
      sourceIp: true,
    },
    orderBy: {
      _count: {
        sourceIp: 'desc',
      },
    },
    take: limit,
  });

  // For each top IP, get additional details
  const topAttackers: TopAttacker[] = [];

  for (const ipCount of ipCounts) {
    const attacks = await prisma.attack.findMany({
      where: {
        ...where,
        sourceIp: ipCount.sourceIp,
      },
      include: {
        sensor: true,
      },
    });

    // Get unique protocols
    const protocols = Array.from(
      new Set(attacks.map((a) => a.protocol)),
    ).sort();

    // Get unique sensors hit
    const sensorsHit = Array.from(
      new Set(attacks.map((a) => a.sensor.name)),
    ).sort();

    // Get geo data from first attack with geo info
    const geoAttack = attacks.find(
      (a) =>
        a.country !== null &&
        a.latitude !== null &&
        a.longitude !== null,
    );

    topAttackers.push({
      sourceIp: ipCount.sourceIp,
      country: geoAttack?.country || undefined,
      city: geoAttack?.city || undefined,
      latitude: geoAttack?.latitude || undefined,
      longitude: geoAttack?.longitude || undefined,
      attackCount: ipCount._count.sourceIp,
      protocols,
      sensorsHit,
    });
  }

  return topAttackers;
}

/**
 * Get attacks for specific sensor
 *
 * @param sensorId - Sensor database ID
 * @param limit - Maximum number of attacks to return (default: 20)
 * @param offset - Number of attacks to skip for pagination (default: 0)
 * @returns Object with attacks array and total count
 * @throws SensorNotFoundError if sensor doesn't exist
 */
export async function getAttacksBySensor(
  sensorId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<{
  attacks: AttackResponse[];
  total: number;
}> {
  // Verify sensor exists
  const sensor = await prisma.sensor.findUnique({
    where: { id: sensorId },
  });

  if (!sensor) {
    throw new SensorNotFoundError(`Sensor with ID ${sensorId} not found`);
  }

  const total = await prisma.attack.count({
    where: { sensorId },
  });

  const attacks = await prisma.attack.findMany({
    where: { sensorId },
    orderBy: {
      timestamp: 'desc',
    },
    skip: offset,
    take: limit,
  });

  return {
    attacks,
    total,
  };
}

/**
 * Get detailed attack payload from MongoDB
 *
 * @param mongoId - MongoDB ObjectId as string
 * @returns Attack event document or null if not found
 */
export async function getAttackDetail(
  mongoId: string,
): Promise<Record<string, any> | null> {
  const db = getMongoDB();
  const attackEvents = db.collection('attack_events');

  try {
    const attack = await attackEvents.findOne({
      _id: new ObjectId(mongoId),
    });

    return attack;
  } catch (error) {
    // Invalid ObjectId format
    return null;
  }
}

/**
 * Get geographic statistics for heatmap visualization
 *
 * @param startDate - Optional start date for filtering
 * @param endDate - Optional end date for filtering
 * @returns Array of geographic statistics by country
 */
export async function getGeoStatistics(
  startDate?: Date,
  endDate?: Date,
): Promise<GeoStatistics[]> {
  const where: Prisma.AttackWhereInput = {
    country: { not: null },
    latitude: { not: null },
    longitude: { not: null },
  };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  // Group by country
  const countryCounts = await prisma.attack.groupBy({
    by: ['country'],
    where,
    _count: {
      country: true,
    },
  });

  const geoStats: GeoStatistics[] = [];

  for (const cc of countryCounts) {
    if (!cc.country) continue;

    // Get unique IPs for this country
    const uniqueIps = await prisma.attack.findMany({
      where: {
        ...where,
        country: cc.country,
      },
      select: { sourceIp: true },
      distinct: ['sourceIp'],
    });

    // Get average coordinates for this country
    const attacks = await prisma.attack.findMany({
      where: {
        ...where,
        country: cc.country,
      },
      select: { latitude: true, longitude: true },
      take: 1, // Just get first one for coordinates
    });

    if (attacks.length > 0 && attacks[0].latitude && attacks[0].longitude) {
      geoStats.push({
        country: cc.country,
        country_code: cc.country, // Would be 2-letter code in production
        latitude: attacks[0].latitude,
        longitude: attacks[0].longitude,
        attackCount: cc._count.country,
        uniqueIps: uniqueIps.length,
      });
    }
  }

  return geoStats.sort((a, b) => b.attackCount - a.attackCount);
}

/**
 * Get attack count by honeypot type
 *
 * @param honeypotType - Type of honeypot (dionaea, cowrie, etc.)
 * @returns Number of attacks for this honeypot type
 */
export async function getAttacksByHoneypot(
  honeypotType: string,
): Promise<number> {
  // Get all sensors of this type
  const sensors = await prisma.sensor.findMany({
    where: { honeypot: honeypotType },
  });

  if (sensors.length === 0) {
    return 0;
  }

  const sensorIds = sensors.map((s) => s.id);

  const count = await prisma.attack.count({
    where: {
      sensorId: { in: sensorIds },
    },
  });

  return count;
}

/**
 * Search attacks by source IP address
 *
 * @param sourceIp - Source IP address to search for
 * @param limit - Maximum number of results (default: 50)
 * @returns Array of attacks from this IP
 */
export async function searchAttacksByIp(
  sourceIp: string,
  limit: number = 50,
): Promise<AttackResponse[]> {
  if (!validateSourceIp(sourceIp)) {
    throw new AttackValidationError(`Invalid source IP address: ${sourceIp}`);
  }

  const attacks = await prisma.attack.findMany({
    where: { sourceIp },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit,
  });

  return attacks;
}

/**
 * Delete old attacks (data retention policy)
 *
 * Deletes attacks older than specified number of days from both
 * PostgreSQL and MongoDB.
 *
 * @param olderThanDays - Delete attacks older than this many days
 * @returns Number of attacks deleted
 */
export async function deleteOldAttacks(olderThanDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  // Get attacks to delete (need their mongoIds)
  const attacksToDelete = await prisma.attack.findMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
    select: { mongoId: true },
  });

  // Delete from MongoDB
  const db = getMongoDB();
  const attackEvents = db.collection('attack_events');

  const mongoIds = attacksToDelete
    .filter((a) => a.mongoId)
    .map((a) => new ObjectId(a.mongoId!));

  if (mongoIds.length > 0) {
    await attackEvents.deleteMany({
      _id: { $in: mongoIds },
    });
  }

  // Delete from PostgreSQL
  const result = await prisma.attack.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Handle attack event from HPFeeds broker
 * This function would be called by HPFeeds event listener
 *
 * NOTE: This is a skeleton implementation. The actual HPFeeds integration
 * would call this function when attack events are received.
 *
 * @param sensorUuid - Sensor UUID that published the event
 * @param channel - HPFeeds channel (e.g., "dionaea.capture")
 * @param payload - Attack event payload (honeypot-specific format)
 * @returns Promise<void>
 */
export async function handleHPFeedsAttackEvent(
  sensorUuid: string,
  channel: string,
  payload: Record<string, any>,
): Promise<void> {
  // Parse payload based on honeypot type (channel)
  // This would be implemented in future phases with actual HPFeeds integration

  // Example parsing for different honeypot types:
  // - dionaea.capture: malware samples, connection data
  // - cowrie.sessions: SSH/Telnet session logs
  // - conpot.events: ICS/SCADA interaction logs

  // Extract common fields
  const sourceIp = payload.src_ip || payload.source_ip || payload.remote_host;
  const protocol = payload.protocol || 'OTHER';
  const port = payload.dst_port || payload.port;

  // Enrich with geolocation (would use GeoIP2 in production)
  // For now, this is a placeholder
  const country = undefined;
  const city = undefined;
  const latitude = undefined;
  const longitude = undefined;

  // Record the attack
  await recordAttackEvent(
    sensorUuid,
    sourceIp,
    protocol,
    payload,
    port,
    country,
    city,
    latitude,
    longitude,
  );
}
