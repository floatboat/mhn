/**
 * Analytics API Routes - Statistical analysis and trends
 * Provides aggregated data on attacks, protocols, and geographic patterns
 */

import { FastifyInstance } from 'fastify';
import * as analyticsService from '../../services/analytics.service';
import {
  AttackStatsSchema,
  TimeSeriesSchema,
  ProtocolDistributionSchema,
  TopAttackersSchema,
  GeoHeatmapSchema,
  SensorStatsListSchema,
  CountryStatsListSchema,
  PortStatsListSchema,
  HourlyFrequencySchema,
} from '../../types/analytics.types';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/analytics/attacks/stats
   * Get overall attack statistics
   */
  fastify.get<{
    Querystring: { startTime?: string; endTime?: string };
  }>(
    '/analytics/attacks/stats',
    {
      schema: {
        params: {},
        querystring: {
          type: 'object',
          properties: {
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: AttackStatsSchema },
      },
    },
    async (request, reply) => {
      try {
        const { startTime, endTime } = request.query;
        const stats = await analyticsService.getAttackStats(
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(stats);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get attack stats';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/attacks/timeseries
   * Get time-series attack data
   */
  fastify.get<{
    Querystring: { period?: string; limit?: string; startTime?: string };
  }>(
    '/analytics/attacks/timeseries',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['hourly', 'daily', 'weekly', 'monthly'],
              description: 'Aggregation period',
            },
            limit: { type: 'string', description: 'Number of data points' },
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
          },
        },
        response: { 200: TimeSeriesSchema },
      },
    },
    async (request, reply) => {
      try {
        const period = (request.query.period || 'daily') as analyticsService.TimePeriod;
        const limit = parseInt(request.query.limit || '30');
        const startTime = request.query.startTime ? new Date(request.query.startTime) : undefined;

        const timeseries = await analyticsService.getAttackTimeSeries(period, limit, startTime);

        return reply.code(200).send(timeseries);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get timeseries';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/protocols
   * Get protocol distribution
   */
  fastify.get<{
    Querystring: { startTime?: string; endTime?: string };
  }>(
    '/analytics/protocols',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: ProtocolDistributionSchema },
      },
    },
    async (request, reply) => {
      try {
        const { startTime, endTime } = request.query;
        const protocols = await analyticsService.getProtocolDistribution(
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(protocols);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get protocols';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/attackers/top
   * Get top attacking IPs
   */
  fastify.get<{
    Querystring: { limit?: string; startTime?: string; endTime?: string };
  }>(
    '/analytics/attackers/top',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', description: 'Number of top attackers (default: 10)' },
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: TopAttackersSchema },
      },
    },
    async (request, reply) => {
      try {
        const limit = parseInt(request.query.limit || '10');
        const { startTime, endTime } = request.query;

        const topAttackers = await analyticsService.getTopAttackers(
          limit,
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(topAttackers);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get top attackers';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/geo/heatmap
   * Get geographic heatmap data
   */
  fastify.get<{
    Querystring: { startTime?: string; endTime?: string };
  }>(
    '/analytics/geo/heatmap',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: GeoHeatmapSchema },
      },
    },
    async (request, reply) => {
      try {
        const { startTime, endTime } = request.query;
        const heatmap = await analyticsService.getGeoHeatmap(
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(heatmap);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get heatmap';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/sensors
   * Get per-sensor statistics
   */
  fastify.get<{
    Querystring: { startTime?: string; endTime?: string };
  }>(
    '/analytics/sensors',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: SensorStatsListSchema },
      },
    },
    async (request, reply) => {
      try {
        const { startTime, endTime } = request.query;
        const sensorStats = await analyticsService.getSensorStats(
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(sensorStats);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get sensor stats';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/countries
   * Get attack statistics by country
   */
  fastify.get<{
    Querystring: { limit?: string; startTime?: string; endTime?: string };
  }>(
    '/analytics/countries',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', description: 'Number of countries (default: 50)' },
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: CountryStatsListSchema },
      },
    },
    async (request, reply) => {
      try {
        const limit = parseInt(request.query.limit || '50');
        const { startTime, endTime } = request.query;

        const countries = await analyticsService.getAttacksByCountry(
          limit,
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(countries);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get countries';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/ports
   * Get attack statistics by target port
   */
  fastify.get<{
    Querystring: { limit?: string; startTime?: string; endTime?: string };
  }>(
    '/analytics/ports',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', description: 'Number of ports (default: 20)' },
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: PortStatsListSchema },
      },
    },
    async (request, reply) => {
      try {
        const limit = parseInt(request.query.limit || '20');
        const { startTime, endTime } = request.query;

        const ports = await analyticsService.getTopTargetPorts(
          limit,
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(ports);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get ports';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/analytics/frequency/hourly
   * Get hourly frequency distribution (attacks per hour of day)
   */
  fastify.get(
    '/analytics/frequency/hourly',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            startTime: { type: 'string', format: 'date-time', description: 'Start time' },
            endTime: { type: 'string', format: 'date-time', description: 'End time' },
          },
        },
        response: { 200: HourlyFrequencySchema },
      },
    },
    async (request, reply) => {
      try {
        const { startTime, endTime } = request.query as any;
        const frequency = await analyticsService.getHourlyFrequency(
          startTime ? new Date(startTime) : undefined,
          endTime ? new Date(endTime) : undefined,
        );

        return reply.code(200).send(frequency);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get frequency';
        return reply.code(500).send({ message });
      }
    },
  );
}
