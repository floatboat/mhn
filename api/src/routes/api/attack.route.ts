/**
 * Attack API Routes
 *
 * Exposes HTTP endpoints for querying and analyzing attack data
 * from both PostgreSQL (metadata) and MongoDB (full payloads)
 */

import { FastifyInstance } from 'fastify';
import * as attackHandler from '../../handlers/attack.handler';
import * as attackTypes from '../../types/attack.types';

export default async function attackRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/attack
   * List attacks with filtering and pagination
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack',
    schema: attackTypes.getAttacksSchema,
    handler: attackHandler.getAttacksHandler,
  });

  /**
   * GET /api/attack/stats
   * Get attack statistics and aggregated data
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/stats',
    schema: attackTypes.getAttackStatsSchema,
    handler: attackHandler.getAttackStatsHandler,
  });

  /**
   * GET /api/attack/top-attackers
   * Get leaderboard of top attackers by IP
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/top-attackers',
    schema: attackTypes.getTopAttackersSchema,
    handler: attackHandler.getTopAttackersHandler,
  });

  /**
   * GET /api/attack/geo
   * Get geographic statistics for heatmap visualization
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/geo',
    schema: attackTypes.getGeoStatsSchema,
    handler: attackHandler.getGeoStatsHandler,
  });

  /**
   * GET /api/attack/sensor/:sensorId
   * Get attacks for specific sensor with pagination
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/sensor/:sensorId',
    schema: attackTypes.getAttacksBySensorSchema,
    handler: attackHandler.getAttacksBySensorHandler,
  });

  /**
   * GET /api/attack/search
   * Search attacks by source IP address
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/search',
    schema: attackTypes.searchAttacksByIpSchema,
    handler: attackHandler.searchAttacksByIpHandler,
  });

  /**
   * GET /api/attack/:id
   * Get detailed attack data from MongoDB by ObjectId
   * Requires: api_key or JWT auth (not implemented yet)
   */
  fastify.route({
    method: 'GET',
    url: '/attack/:id',
    schema: attackTypes.getAttackDetailSchema,
    handler: attackHandler.getAttackDetailHandler,
  });
}
