"use strict";
/**
 * Rule Request Handlers
 * Handles HTTP requests for rule and rule source management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuleHandler = createRuleHandler;
exports.listRulesHandler = listRulesHandler;
exports.getRuleHandler = getRuleHandler;
exports.updateRuleHandler = updateRuleHandler;
exports.deleteRuleHandler = deleteRuleHandler;
exports.exportRulesHandler = exportRulesHandler;
exports.createRuleSourceHandler = createRuleSourceHandler;
exports.listRuleSourcesHandler = listRuleSourcesHandler;
exports.getRuleSourceHandler = getRuleSourceHandler;
exports.updateRuleSourceHandler = updateRuleSourceHandler;
exports.deleteRuleSourceHandler = deleteRuleSourceHandler;
const rule_service_1 = require("../services/rule.service");
const rule_renderer_1 = require("../lib/rule-renderer");
/**
 * Create a new rule
 * POST /api/rule
 * Requires admin role
 */
async function createRuleHandler(request, reply) {
    try {
        const { ruleFormat, sourceId } = request.body;
        request.log.info({ ruleFormat: ruleFormat.substring(0, 50) }, 'Creating rule');
        const rule = await (0, rule_service_1.createRule)(ruleFormat, sourceId);
        request.log.info({ ruleId: rule.id, sid: rule.sid, rev: rule.rev }, 'Rule created successfully');
        const response = {
            id: rule.id,
            message: rule.message,
            classtype: rule.classtype,
            sid: rule.sid,
            rev: rule.rev,
            references: rule.references.map(r => r.text),
            notes: rule.notes || undefined,
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString(),
        };
        reply.code(201).send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleExistsError) {
            request.log.warn({ error: error.message }, 'Rule already exists');
            reply.code(409).send({ message: error.message });
        }
        else if (error instanceof rule_service_1.RuleValidationError) {
            request.log.warn({ error: error.message }, 'Rule validation failed');
            reply.code(400).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * List rules with optional filtering
 * GET /api/rule
 * Requires api_key
 */
async function listRulesHandler(request, reply) {
    try {
        const isActive = request.query.isActive ? request.query.isActive === 'true' : undefined;
        const classtype = request.query.classtype;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
        const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
        request.log.info({ isActive, classtype, limit, offset }, 'Listing rules');
        const result = await (0, rule_service_1.listRules)({
            isActive,
            classtype,
            limit,
            offset,
        });
        request.log.info({ count: result.rules.length, total: result.total }, 'Rules retrieved');
        const response = result.rules.map(rule => ({
            id: rule.id,
            message: rule.message,
            classtype: rule.classtype,
            sid: rule.sid,
            rev: rule.rev,
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
        }));
        reply.send(response);
    }
    catch (error) {
        throw error;
    }
}
/**
 * Get a single rule by ID
 * GET /api/rule/:id
 * Requires api_key
 */
async function getRuleHandler(request, reply) {
    try {
        const ruleId = parseInt(request.params.id, 10);
        request.log.info({ ruleId }, 'Getting rule');
        const rule = await (0, rule_service_1.getRuleById)(ruleId);
        request.log.info({ ruleId }, 'Rule retrieved');
        const response = {
            id: rule.id,
            message: rule.message,
            classtype: rule.classtype,
            sid: rule.sid,
            rev: rule.rev,
            references: rule.references.map(r => r.text),
            notes: rule.notes || undefined,
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString(),
        };
        reply.send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ ruleId: request.params.id }, 'Rule not found');
            reply.code(404).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * Update a rule
 * PUT /api/rule/:id
 * Requires admin role
 */
async function updateRuleHandler(request, reply) {
    try {
        const ruleId = parseInt(request.params.id, 10);
        const { notes, isActive } = request.body;
        request.log.info({ ruleId }, 'Updating rule');
        const rule = await (0, rule_service_1.updateRule)(ruleId, {
            notes,
            isActive,
        });
        request.log.info({ ruleId }, 'Rule updated successfully');
        const response = {
            id: rule.id,
            message: rule.message,
            classtype: rule.classtype,
            sid: rule.sid,
            rev: rule.rev,
            references: rule.references.map(r => r.text),
            notes: rule.notes || undefined,
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString(),
        };
        reply.send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ ruleId: request.params.id }, 'Rule not found');
            reply.code(404).send({ message: error.message });
        }
        else if (error instanceof rule_service_1.RuleValidationError) {
            request.log.warn({ error: error.message }, 'Rule validation failed');
            reply.code(400).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * Delete a rule
 * DELETE /api/rule/:id
 * Requires admin role
 */
async function deleteRuleHandler(request, reply) {
    try {
        const ruleId = parseInt(request.params.id, 10);
        request.log.info({ ruleId }, 'Deleting rule');
        await (0, rule_service_1.deleteRule)(ruleId);
        request.log.info({ ruleId }, 'Rule deleted successfully');
        reply.code(204).send();
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ ruleId: request.params.id }, 'Rule not found');
            reply.code(404).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * Export all active rules in Snort format
 * GET /api/rules.rules
 * Requires api_key
 * Returns plain text file with all active rules
 */
async function exportRulesHandler(request, reply) {
    try {
        request.log.info('Exporting rules');
        const result = await (0, rule_service_1.listRules)({ isActive: true });
        // Render each rule and join with newlines
        const ruleTexts = result.rules.map(rule => (0, rule_renderer_1.renderRuleTemplate)(rule.ruleFormat, {}));
        const rulesContent = ruleTexts.join('\n');
        request.log.info({ count: result.rules.length }, 'Rules exported');
        reply
            .type('text/plain')
            .send(rulesContent);
    }
    catch (error) {
        throw error;
    }
}
/**
 * Create a new rule source
 * POST /api/rulesource
 * Requires admin role
 */
async function createRuleSourceHandler(request, reply) {
    try {
        const { name, uri, note } = request.body;
        request.log.info({ name, uri }, 'Creating rule source');
        const source = await (0, rule_service_1.createRuleSource)(name, uri, note);
        request.log.info({ sourceId: source.id, name }, 'Rule source created successfully');
        const response = {
            id: source.id,
            name: source.name,
            uri: source.uri,
            note: source.note || undefined,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
        };
        reply.code(201).send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleSourceExistsError) {
            request.log.warn({ error: error.message }, 'Rule source already exists');
            reply.code(409).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * List all rule sources
 * GET /api/rulesource
 * Requires api_key
 */
async function listRuleSourcesHandler(request, reply) {
    try {
        request.log.info('Listing rule sources');
        const sources = await (0, rule_service_1.listRuleSources)();
        request.log.info({ count: sources.length }, 'Rule sources retrieved');
        const response = sources.map(source => ({
            id: source.id,
            name: source.name,
            uri: source.uri,
            note: source.note || undefined,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
        }));
        reply.send(response);
    }
    catch (error) {
        throw error;
    }
}
/**
 * Get a single rule source by ID
 * GET /api/rulesource/:id
 * Requires api_key
 */
async function getRuleSourceHandler(request, reply) {
    try {
        const sourceId = parseInt(request.params.id, 10);
        request.log.info({ sourceId }, 'Getting rule source');
        const source = await (0, rule_service_1.getRuleSource)(sourceId);
        request.log.info({ sourceId }, 'Rule source retrieved');
        const response = {
            id: source.id,
            name: source.name,
            uri: source.uri,
            note: source.note || undefined,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
        };
        reply.send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ sourceId: request.params.id }, 'Rule source not found');
            reply.code(404).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * Update a rule source
 * PUT /api/rulesource/:id
 * Requires admin role
 */
async function updateRuleSourceHandler(request, reply) {
    try {
        const sourceId = parseInt(request.params.id, 10);
        const { name, uri, note } = request.body;
        request.log.info({ sourceId }, 'Updating rule source');
        const source = await (0, rule_service_1.updateRuleSource)(sourceId, { name, uri, note });
        request.log.info({ sourceId }, 'Rule source updated successfully');
        const response = {
            id: source.id,
            name: source.name,
            uri: source.uri,
            note: source.note || undefined,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
        };
        reply.send(response);
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ sourceId: request.params.id }, 'Rule source not found');
            reply.code(404).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
/**
 * Delete a rule source
 * DELETE /api/rulesource/:id
 * Requires admin role
 */
async function deleteRuleSourceHandler(request, reply) {
    try {
        const sourceId = parseInt(request.params.id, 10);
        request.log.info({ sourceId }, 'Deleting rule source');
        await (0, rule_service_1.deleteRuleSource)(sourceId);
        request.log.info({ sourceId }, 'Rule source deleted successfully');
        reply.code(204).send();
    }
    catch (error) {
        if (error instanceof rule_service_1.RuleNotFoundError) {
            request.log.warn({ sourceId: request.params.id }, 'Rule source not found');
            reply.code(404).send({ message: error.message });
        }
        else {
            throw error;
        }
    }
}
