/**
 * Export API Routes - Export attack data in various formats
 * Provides JSON, CSV, and other export formats for attack data
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

export default async function exportRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/export/attacks/json
   * Export attacks as JSON with optional filtering
   */
  fastify.get('/export/attacks/json', async (request, reply) => {
    const { startTime, endTime, sensorId, sourceIp, limit = 1000 } = request.query as any;

    const where: any = {};
    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) where.timestamp.gte = new Date(startTime);
      if (endTime) where.timestamp.lte = new Date(endTime);
    }
    if (sensorId) where.sensorId = parseInt(sensorId);
    if (sourceIp) where.sourceIp = sourceIp;

    const attacks = await prisma.attack.findMany({
      where,
      take: Math.min(parseInt(limit), 10000),
      orderBy: { timestamp: 'desc' },
      include: {
        sensor: {
          select: { name: true, uuid: true, honeypot: true },
        },
      },
    });

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="attacks.json"');
    return { attacks, count: attacks.length };
  });

  /**
   * GET /api/export/attacks/csv
   * Export attacks as CSV
   */
  fastify.get('/export/attacks/csv', async (request, reply) => {
    const { startTime, endTime, sensorId, sourceIp, limit = 1000 } = request.query as any;

    const where: any = {};
    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) where.timestamp.gte = new Date(startTime);
      if (endTime) where.timestamp.lte = new Date(endTime);
    }
    if (sensorId) where.sensorId = parseInt(sensorId);
    if (sourceIp) where.sourceIp = sourceIp;

    const attacks = await prisma.attack.findMany({
      where,
      take: Math.min(parseInt(limit), 10000),
      orderBy: { timestamp: 'desc' },
      include: {
        sensor: {
          select: { name: true, uuid: true, honeypot: true },
        },
      },
    });

    // Build CSV
    const headers = [
      'timestamp',
      'sourceIp',
      'targetPort',
      'protocol',
      'sensorName',
      'sensorUuid',
      'honeypotType',
      'country',
    ];
    const rows = attacks.map(a => [
      a.timestamp.toISOString(),
      a.sourceIp,
      a.port || '',
      a.protocol,
      a.sensor.name,
      a.sensor.uuid,
      a.sensor.honeypot,
      a.country || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="attacks.csv"');
    return reply.send(csv);
  });

  /**
   * GET /api/export/attacks/ndjson
   * Export attacks as newline-delimited JSON (NDJSON)
   */
  fastify.get('/export/attacks/ndjson', async (request, reply) => {
    const { startTime, endTime, sensorId, sourceIp, limit = 1000 } = request.query as any;

    const where: any = {};
    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) where.timestamp.gte = new Date(startTime);
      if (endTime) where.timestamp.lte = new Date(endTime);
    }
    if (sensorId) where.sensorId = parseInt(sensorId);
    if (sourceIp) where.sourceIp = sourceIp;

    const attacks = await prisma.attack.findMany({
      where,
      take: Math.min(parseInt(limit), 10000),
      orderBy: { timestamp: 'desc' },
      include: {
        sensor: {
          select: { name: true, uuid: true, honeypot: true },
        },
      },
    });

    const ndjson = attacks.map(a => JSON.stringify(a)).join('\n');

    reply.header('Content-Type', 'application/x-ndjson');
    reply.header('Content-Disposition', 'attachment; filename="attacks.ndjson"');
    return reply.send(ndjson);
  });

  /**
   * GET /api/export/statistics
   * Export attack statistics summary
   */
  fastify.get('/export/statistics', async (request, reply) => {
    const { startTime, endTime } = request.query as any;

    const where: any = {};
    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) where.timestamp.gte = new Date(startTime);
      if (endTime) where.timestamp.lte = new Date(endTime);
    }

    const totalAttacks = await prisma.attack.count({ where });

    const uniqueAttackers = await prisma.attack.findMany({
      where,
      distinct: ['sourceIp'],
      select: { sourceIp: true },
    });

    const uniqueTargets = await prisma.attack.findMany({
      where,
      distinct: ['port'],
      select: { port: true },
    });

    const protocols = await prisma.attack.groupBy({
      by: ['protocol'],
      where,
      _count: true,
    });

    const countries = await prisma.attack.groupBy({
      by: ['country'],
      where,
      _count: true,
    });

    const statistics = {
      timeRange: { startTime, endTime },
      totalAttacks,
      uniqueAttackers: uniqueAttackers.length,
      uniqueTargets: uniqueTargets.filter(t => t.port).length,
      protocols: protocols.map(p => ({ protocol: p.protocol, count: p._count })),
      topCountries: countries
        .filter(c => c.country)
        .sort((a, b) => b._count - a._count)
        .slice(0, 10)
        .map(c => ({ country: c.country, count: c._count })),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="statistics.json"');
    return statistics;
  });

  /**
   * GET /api/export/heatmap
   * Export geographic heatmap data
   */
  fastify.get('/export/heatmap', async (request, reply) => {
    const { startTime, endTime } = request.query as any;

    const where: any = {};
    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) where.timestamp.gte = new Date(startTime);
      if (endTime) where.timestamp.lte = new Date(endTime);
    }

    const attacks = await prisma.attack.findMany({
      where,
      select: {
        sourceIp: true,
        country: true,
        latitude: true,
        longitude: true,
      },
    });

    const heatmapData = Array.from(
      attacks
        .reduce((map, attack) => {
          if (!attack.country) return map;

          const key = attack.country;
          if (!map.has(key)) {
            map.set(key, {
              country: attack.country,
              count: 0,
              ips: new Set<string>(),
              latitude: attack.latitude,
              longitude: attack.longitude,
            });
          }

          const entry = map.get(key)!;
          entry.count++;
          entry.ips.add(attack.sourceIp);

          return map;
        }, new Map())
        .values(),
    )
      .map(entry => ({
        country: entry.country,
        attackCount: entry.count,
        uniqueIps: entry.ips.size,
        latitude: entry.latitude,
        longitude: entry.longitude,
      }))
      .sort((a, b) => b.attackCount - a.attackCount);

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="heatmap.json"');
    return heatmapData;
  });
}
