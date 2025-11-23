/**
 * Dashboard API Routes - Real-time dashboard data and alerts
 * Provides sensor status, active threats, and risk assessment
 */

import { FastifyInstance } from 'fastify';
import * as dashboardService from '../../services/dashboard.service';
import {
  SensorStatusListSchema,
  ActiveThreatsSchema,
  DashboardSummarySchema,
  SensorHealthSchema,
  AttackTrendsSchema,
  AlertsSchema,
  RiskLevelSchema,
} from '../../types/dashboard.types';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/dashboard/summary
   * Get dashboard summary (key metrics overview)
   */
  fastify.get(
    '/dashboard/summary',
    {
      schema: {
        response: { 200: DashboardSummarySchema },
      },
    },
    async (request, reply) => {
      try {
        const summary = await dashboardService.getDashboardSummary();
        return reply.code(200).send(summary);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get dashboard summary';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/sensors
   * Get all sensor statuses
   */
  fastify.get(
    '/dashboard/sensors',
    {
      schema: {
        response: { 200: SensorStatusListSchema },
      },
    },
    async (request, reply) => {
      try {
        const statuses = await dashboardService.getSensorStatuses();
        return reply.code(200).send(statuses);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get sensor statuses';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/threats
   * Get active/recent threats
   */
  fastify.get<{
    Querystring: { hours?: string; limit?: string };
  }>(
    '/dashboard/threats',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            hours: { type: 'string', description: 'Look back N hours (default: 1)' },
            limit: { type: 'string', description: 'Maximum threats to return (default: 100)' },
          },
        },
        response: { 200: ActiveThreatsSchema },
      },
    },
    async (request, reply) => {
      try {
        const hours = parseInt(request.query.hours || '1');
        const limit = parseInt(request.query.limit || '100');

        const threats = await dashboardService.getActiveThreats(hours, limit);
        return reply.code(200).send(threats);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get active threats';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/sensor/:id/health
   * Get health metrics for a specific sensor
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/dashboard/sensor/:id/health',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Sensor ID' },
          },
        },
        response: { 200: SensorHealthSchema },
      },
    },
    async (request, reply) => {
      try {
        const sensorId = parseInt(request.params.id);

        if (isNaN(sensorId)) {
          return reply.code(400).send({ message: 'Invalid sensor ID' });
        }

        const health = await dashboardService.getSensorHealth(sensorId);
        return reply.code(200).send(health);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get sensor health';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/trends
   * Get attack trends over time
   */
  fastify.get<{
    Querystring: { hours?: string };
  }>(
    '/dashboard/trends',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            hours: { type: 'string', description: 'Number of hours to look back (default: 24)' },
          },
        },
        response: { 200: AttackTrendsSchema },
      },
    },
    async (request, reply) => {
      try {
        const hours = parseInt(request.query.hours || '24');
        const trends = await dashboardService.getAttackTrends(hours);
        return reply.code(200).send(trends);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get trends';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/alerts
   * Get current alerts
   */
  fastify.get(
    '/dashboard/alerts',
    {
      schema: {
        response: { 200: AlertsSchema },
      },
    },
    async (request, reply) => {
      try {
        const alerts = await dashboardService.getAlerts();
        return reply.code(200).send(alerts);
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get alerts';
        return reply.code(500).send({ message });
      }
    },
  );

  /**
   * GET /api/dashboard/risk
   * Get current network risk level
   */
  fastify.get(
    '/dashboard/risk',
    {
      schema: {
        response: { 200: RiskLevelSchema },
      },
    },
    async (request, reply) => {
      try {
        const level = await dashboardService.getRiskLevel();
        return reply.code(200).send({ level });
      } catch (error) {
        fastify.log.error(error);
        const message = error instanceof Error ? error.message : 'Failed to get risk level';
        return reply.code(500).send({ message });
      }
    },
  );
}
