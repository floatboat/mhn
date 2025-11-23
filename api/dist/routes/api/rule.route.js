"use strict";
/**
 * Rule API Routes
 * Defines HTTP endpoints for rule and rule source management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ruleRoutes;
const rule_handler_1 = require("../../handlers/rule.handler");
const rule_types_1 = require("../../types/rule.types");
/**
 * Register rule routes
 * All endpoints require authentication (api_key for reads, admin for writes)
 */
async function ruleRoutes(fastify) {
    // Rule Management Endpoints
    // Create new rule (admin only)
    // POST /api/rule
    fastify.route({
        method: 'POST',
        url: '/rule',
        schema: rule_types_1.createRuleSchema,
        handler: rule_handler_1.createRuleHandler,
    });
    // List rules with optional filtering (api_key required)
    // GET /api/rule?isActive=true&classtype=trojan&limit=50&offset=0
    fastify.route({
        method: 'GET',
        url: '/rule',
        schema: rule_types_1.listRulesSchema,
        handler: rule_handler_1.listRulesHandler,
    });
    // Get single rule by ID (api_key required)
    // GET /api/rule/:id
    fastify.route({
        method: 'GET',
        url: '/rule/:id',
        schema: rule_types_1.getRuleSchema,
        handler: rule_handler_1.getRuleHandler,
    });
    // Update rule (admin only)
    // PUT /api/rule/:id
    fastify.route({
        method: 'PUT',
        url: '/rule/:id',
        schema: rule_types_1.updateRuleSchema,
        handler: rule_handler_1.updateRuleHandler,
    });
    // Delete rule (admin only)
    // DELETE /api/rule/:id
    fastify.route({
        method: 'DELETE',
        url: '/rule/:id',
        schema: rule_types_1.deleteRuleSchema,
        handler: rule_handler_1.deleteRuleHandler,
    });
    // Export all active rules in Snort format (api_key required)
    // GET /api/rules.rules
    fastify.route({
        method: 'GET',
        url: '/rules.rules',
        schema: rule_types_1.exportRulesSchema,
        handler: rule_handler_1.exportRulesHandler,
    });
    // Rule Source Management Endpoints
    // Create new rule source (admin only)
    // POST /api/rulesource
    fastify.route({
        method: 'POST',
        url: '/rulesource',
        schema: rule_types_1.createRuleSourceSchema,
        handler: rule_handler_1.createRuleSourceHandler,
    });
    // List all rule sources (api_key required)
    // GET /api/rulesource
    fastify.route({
        method: 'GET',
        url: '/rulesource',
        schema: rule_types_1.listRuleSourcesSchema,
        handler: rule_handler_1.listRuleSourcesHandler,
    });
    // Get single rule source by ID (api_key required)
    // GET /api/rulesource/:id
    fastify.route({
        method: 'GET',
        url: '/rulesource/:id',
        schema: rule_types_1.getRuleSourceSchema,
        handler: rule_handler_1.getRuleSourceHandler,
    });
    // Update rule source (admin only)
    // PUT /api/rulesource/:id
    fastify.route({
        method: 'PUT',
        url: '/rulesource/:id',
        schema: rule_types_1.updateRuleSourceSchema,
        handler: rule_handler_1.updateRuleSourceHandler,
    });
    // Delete rule source (admin only)
    // DELETE /api/rulesource/:id
    fastify.route({
        method: 'DELETE',
        url: '/rulesource/:id',
        schema: rule_types_1.deleteRuleSourceSchema,
        handler: rule_handler_1.deleteRuleSourceHandler,
    });
}
