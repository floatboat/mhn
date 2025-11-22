/**
 * Rule API Routes
 * Defines HTTP endpoints for rule and rule source management
 */

import { FastifyInstance } from 'fastify';
import {
  createRuleHandler,
  listRulesHandler,
  getRuleHandler,
  updateRuleHandler,
  deleteRuleHandler,
  exportRulesHandler,
  createRuleSourceHandler,
  listRuleSourcesHandler,
  getRuleSourceHandler,
  updateRuleSourceHandler,
  deleteRuleSourceHandler,
} from '../../handlers/rule.handler';
import {
  createRuleSchema,
  listRulesSchema,
  getRuleSchema,
  updateRuleSchema,
  deleteRuleSchema,
  exportRulesSchema,
  createRuleSourceSchema,
  listRuleSourcesSchema,
  getRuleSourceSchema,
  updateRuleSourceSchema,
  deleteRuleSourceSchema,
} from '../../types/rule.types';

/**
 * Register rule routes
 * All endpoints require authentication (api_key for reads, admin for writes)
 */
export default async function ruleRoutes(fastify: FastifyInstance) {
  // Rule Management Endpoints

  // Create new rule (admin only)
  // POST /api/rule
  fastify.route({
    method: 'POST',
    url: '/rule',
    schema: createRuleSchema,
    handler: createRuleHandler,
  });

  // List rules with optional filtering (api_key required)
  // GET /api/rule?isActive=true&classtype=trojan&limit=50&offset=0
  fastify.route({
    method: 'GET',
    url: '/rule',
    schema: listRulesSchema,
    handler: listRulesHandler,
  });

  // Get single rule by ID (api_key required)
  // GET /api/rule/:id
  fastify.route({
    method: 'GET',
    url: '/rule/:id',
    schema: getRuleSchema,
    handler: getRuleHandler,
  });

  // Update rule (admin only)
  // PUT /api/rule/:id
  fastify.route({
    method: 'PUT',
    url: '/rule/:id',
    schema: updateRuleSchema,
    handler: updateRuleHandler,
  });

  // Delete rule (admin only)
  // DELETE /api/rule/:id
  fastify.route({
    method: 'DELETE',
    url: '/rule/:id',
    schema: deleteRuleSchema,
    handler: deleteRuleHandler,
  });

  // Export all active rules in Snort format (api_key required)
  // GET /api/rules.rules
  fastify.route({
    method: 'GET',
    url: '/rules.rules',
    schema: exportRulesSchema,
    handler: exportRulesHandler,
  });

  // Rule Source Management Endpoints

  // Create new rule source (admin only)
  // POST /api/rulesource
  fastify.route({
    method: 'POST',
    url: '/rulesource',
    schema: createRuleSourceSchema,
    handler: createRuleSourceHandler,
  });

  // List all rule sources (api_key required)
  // GET /api/rulesource
  fastify.route({
    method: 'GET',
    url: '/rulesource',
    schema: listRuleSourcesSchema,
    handler: listRuleSourcesHandler,
  });

  // Get single rule source by ID (api_key required)
  // GET /api/rulesource/:id
  fastify.route({
    method: 'GET',
    url: '/rulesource/:id',
    schema: getRuleSourceSchema,
    handler: getRuleSourceHandler,
  });

  // Update rule source (admin only)
  // PUT /api/rulesource/:id
  fastify.route({
    method: 'PUT',
    url: '/rulesource/:id',
    schema: updateRuleSourceSchema,
    handler: updateRuleSourceHandler,
  });

  // Delete rule source (admin only)
  // DELETE /api/rulesource/:id
  fastify.route({
    method: 'DELETE',
    url: '/rulesource/:id',
    schema: deleteRuleSourceSchema,
    handler: deleteRuleSourceHandler,
  });
}
