"use strict";
/**
 * Rules Service - Manage Snort/Suricata IDS rules
 *
 * This service manages:
 * - Creating, reading, updating, deleting rules
 * - Parsing rule text and extracting components
 * - Storing references (CVEs, URLs)
 * - Managing rule sources
 * - Querying and filtering rules
 * - Supporting rule versioning (same SID, different rev)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleSourceExistsError = exports.RuleNotFoundError = exports.RuleExistsError = exports.RuleValidationError = void 0;
exports.validateRuleFormat = validateRuleFormat;
exports.createRule = createRule;
exports.getRuleById = getRuleById;
exports.getRuleBySid = getRuleBySid;
exports.listRules = listRules;
exports.updateRule = updateRule;
exports.deleteRule = deleteRule;
exports.addRuleReference = addRuleReference;
exports.removeRuleReference = removeRuleReference;
exports.searchRules = searchRules;
exports.getRulesByClasstype = getRulesByClasstype;
exports.getRuleStatistics = getRuleStatistics;
exports.setRuleActive = setRuleActive;
exports.createRuleVersion = createRuleVersion;
exports.getRuleVersions = getRuleVersions;
exports.createRuleSource = createRuleSource;
exports.getRuleSource = getRuleSource;
exports.listRuleSources = listRuleSources;
exports.updateRuleSource = updateRuleSource;
exports.deleteRuleSource = deleteRuleSource;
const prisma_1 = require("../lib/prisma");
const rule_parser_1 = require("../lib/rule-parser");
const client_1 = require("@prisma/client");
/**
 * Custom error for rule validation failures
 */
class RuleValidationError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
        this.name = 'RuleValidationError';
    }
}
exports.RuleValidationError = RuleValidationError;
/**
 * Custom error for rule already exists
 */
class RuleExistsError extends Error {
    constructor(sid, rev) {
        super(`Rule with SID ${sid} revision ${rev} already exists`);
        this.statusCode = 409;
        this.name = 'RuleExistsError';
    }
}
exports.RuleExistsError = RuleExistsError;
/**
 * Custom error for rule not found
 */
class RuleNotFoundError extends Error {
    constructor(message = 'Rule not found') {
        super(message);
        this.statusCode = 404;
        this.name = 'RuleNotFoundError';
    }
}
exports.RuleNotFoundError = RuleNotFoundError;
/**
 * Custom error for rule source already exists
 */
class RuleSourceExistsError extends Error {
    constructor(name) {
        super(`Rule source '${name}' already exists`);
        this.statusCode = 409;
        this.name = 'RuleSourceExistsError';
    }
}
exports.RuleSourceExistsError = RuleSourceExistsError;
/**
 * Validate rule format and required fields
 * @param ruleText - Snort rule text to validate
 * @throws RuleValidationError if validation fails
 */
function validateRuleFormat(ruleText) {
    if (!ruleText || !ruleText.trim()) {
        throw new RuleValidationError('Rule text cannot be empty');
    }
    try {
        const parsed = (0, rule_parser_1.parseSnortRule)(ruleText);
        // Validate required fields
        if (!parsed.message) {
            throw new RuleValidationError('Rule must have a message (msg) option');
        }
        if (!parsed.sid) {
            throw new RuleValidationError('Rule must have a SID (sid) option');
        }
        if (!parsed.rev) {
            throw new RuleValidationError('Rule must have a revision (rev) option');
        }
        if (!parsed.classtype) {
            throw new RuleValidationError('Rule must have a classtype (classtype) option');
        }
        return parsed;
    }
    catch (error) {
        if (error instanceof rule_parser_1.InvalidRuleError) {
            throw new RuleValidationError(`Invalid rule format: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Create a new rule from Snort rule text
 * @param ruleText - The Snort rule text
 * @param sourceId - Optional rule source ID
 * @returns Created rule object
 * @throws RuleValidationError if rule format is invalid
 * @throws RuleExistsError if rule (sid, rev) already exists
 */
async function createRule(ruleText, sourceId) {
    // Validate and parse rule
    const parsed = validateRuleFormat(ruleText);
    // Check if rule already exists
    const existing = await prisma_1.prisma.rule.findUnique({
        where: {
            sid_rev: {
                sid: parsed.sid,
                rev: parsed.rev,
            },
        },
    });
    if (existing) {
        throw new RuleExistsError(parsed.sid, parsed.rev);
    }
    // Extract references
    const references = (0, rule_parser_1.extractReferences)(parsed);
    // Create rule with references
    const rule = await prisma_1.prisma.rule.create({
        data: {
            message: parsed.message,
            classtype: parsed.classtype,
            sid: parsed.sid,
            rev: parsed.rev,
            ruleFormat: parsed.rawRule,
            isActive: true,
            ...(sourceId && { sourceId }),
            references: {
                create: references.map((ref) => ({ text: ref })),
            },
        },
        include: {
            references: true,
            source: true,
        },
    });
    return formatRuleResponse(rule);
}
/**
 * Get rule by ID with references
 * @param id - Rule database ID
 * @returns Rule object with references
 * @throws RuleNotFoundError if rule not found
 */
async function getRuleById(id) {
    const rule = await prisma_1.prisma.rule.findUnique({
        where: { id },
        include: {
            references: true,
            source: true,
        },
    });
    if (!rule) {
        throw new RuleNotFoundError(`Rule with ID ${id} not found`);
    }
    return formatRuleResponse(rule);
}
/**
 * Get rule by SID and optional revision
 * @param sid - Snort rule ID
 * @param rev - Optional revision number (defaults to latest)
 * @returns Rule object
 * @throws RuleNotFoundError if rule not found
 */
async function getRuleBySid(sid, rev) {
    let rule;
    if (rev !== undefined) {
        // Get specific revision
        rule = await prisma_1.prisma.rule.findUnique({
            where: {
                sid_rev: { sid, rev },
            },
            include: {
                references: true,
                source: true,
            },
        });
    }
    else {
        // Get latest revision
        const rules = await prisma_1.prisma.rule.findMany({
            where: { sid },
            include: {
                references: true,
                source: true,
            },
            orderBy: { rev: 'desc' },
            take: 1,
        });
        rule = rules[0];
    }
    if (!rule) {
        throw new RuleNotFoundError(`Rule with SID ${sid}${rev !== undefined ? ` revision ${rev}` : ''} not found`);
    }
    return formatRuleResponse(rule);
}
/**
 * List all rules with filtering and pagination
 * @param filters - Optional filters (isActive, classtype, sourceId, search, limit, offset)
 * @returns Object with rules array and total count
 */
async function listRules(filters) {
    const where = {};
    if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
    }
    if (filters?.classtype) {
        where.classtype = filters.classtype;
    }
    if (filters?.sourceId) {
        where.sourceId = filters.sourceId;
    }
    if (filters?.search) {
        where.message = {
            contains: filters.search,
            mode: 'insensitive',
        };
    }
    const total = await prisma_1.prisma.rule.count({ where });
    const rules = await prisma_1.prisma.rule.findMany({
        where,
        include: {
            references: true,
            source: true,
        },
        orderBy: {
            sid: 'desc',
        },
        skip: filters?.offset || 0,
        take: filters?.limit || 20,
    });
    return {
        rules: rules.map(formatRuleResponse),
        total,
    };
}
/**
 * Update rule (notes, isActive status, etc.)
 * Note: Cannot change core fields (message, sid, rev, classtype, ruleFormat)
 * @param id - Rule database ID
 * @param updates - Fields to update (notes, isActive)
 * @returns Updated rule object
 * @throws RuleNotFoundError if rule not found
 */
async function updateRule(id, updates) {
    // Verify rule exists
    const existing = await prisma_1.prisma.rule.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new RuleNotFoundError(`Rule with ID ${id} not found`);
    }
    const rule = await prisma_1.prisma.rule.update({
        where: { id },
        data: updates,
        include: {
            references: true,
            source: true,
        },
    });
    return formatRuleResponse(rule);
}
/**
 * Delete rule and its references
 * @param id - Rule database ID
 * @throws RuleNotFoundError if rule not found
 */
async function deleteRule(id) {
    try {
        await prisma_1.prisma.rule.delete({
            where: { id },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            throw new RuleNotFoundError(`Rule with ID ${id} not found`);
        }
        throw error;
    }
}
/**
 * Add reference to existing rule
 * @param ruleId - Rule database ID
 * @param referenceText - Reference text (CVE, URL, etc.)
 * @returns Created reference object
 * @throws RuleNotFoundError if rule not found
 */
async function addRuleReference(ruleId, referenceText) {
    // Verify rule exists
    const rule = await prisma_1.prisma.rule.findUnique({
        where: { id: ruleId },
    });
    if (!rule) {
        throw new RuleNotFoundError(`Rule with ID ${ruleId} not found`);
    }
    const reference = await prisma_1.prisma.reference.create({
        data: {
            text: referenceText,
            ruleId,
        },
    });
    return reference;
}
/**
 * Remove reference from rule
 * @param referenceId - Reference database ID
 * @throws RuleNotFoundError if reference not found
 */
async function removeRuleReference(referenceId) {
    try {
        await prisma_1.prisma.reference.delete({
            where: { id: referenceId },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            throw new RuleNotFoundError(`Reference with ID ${referenceId} not found`);
        }
        throw error;
    }
}
/**
 * Search rules by message, classtype, or CVE
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of matching rules
 */
async function searchRules(query, limit = 20) {
    const rules = await prisma_1.prisma.rule.findMany({
        where: {
            OR: [
                {
                    message: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    classtype: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    references: {
                        some: {
                            text: {
                                contains: query,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ],
        },
        include: {
            references: true,
            source: true,
        },
        take: limit,
        orderBy: {
            sid: 'desc',
        },
    });
    return rules.map(formatRuleResponse);
}
/**
 * Get rules by classification type
 * @param classtype - Rule classification type
 * @param limit - Maximum number of results (default: 20)
 * @param offset - Number of results to skip (default: 0)
 * @returns Object with rules array and total count
 */
async function getRulesByClasstype(classtype, limit = 20, offset = 0) {
    const where = { classtype };
    const total = await prisma_1.prisma.rule.count({ where });
    const rules = await prisma_1.prisma.rule.findMany({
        where,
        include: {
            references: true,
            source: true,
        },
        orderBy: {
            sid: 'desc',
        },
        skip: offset,
        take: limit,
    });
    return {
        rules: rules.map(formatRuleResponse),
        total,
    };
}
/**
 * Get rule statistics
 * @returns Statistics about rules in the database
 */
async function getRuleStatistics() {
    const totalRules = await prisma_1.prisma.rule.count();
    const activeRules = await prisma_1.prisma.rule.count({ where: { isActive: true } });
    const inactiveRules = await prisma_1.prisma.rule.count({ where: { isActive: false } });
    // Rules by classtype
    const classtypeCounts = await prisma_1.prisma.rule.groupBy({
        by: ['classtype'],
        _count: {
            classtype: true,
        },
        orderBy: {
            _count: {
                classtype: 'desc',
            },
        },
    });
    const rulesByClasstype = classtypeCounts.map((c) => ({
        classtype: c.classtype,
        count: c._count.classtype,
    }));
    // Rules by source
    const sourceCounts = await prisma_1.prisma.rule.groupBy({
        by: ['sourceId'],
        where: {
            sourceId: { not: null },
        },
        _count: {
            sourceId: true,
        },
    });
    const rulesBySources = [];
    for (const sc of sourceCounts) {
        if (sc.sourceId) {
            const source = await prisma_1.prisma.ruleSource.findUnique({
                where: { id: sc.sourceId },
            });
            if (source) {
                rulesBySources.push({
                    sourceName: source.name,
                    count: sc._count.sourceId,
                });
            }
        }
    }
    // Unique SIDs
    const uniqueSids = await prisma_1.prisma.rule.findMany({
        select: { sid: true },
        distinct: ['sid'],
    });
    return {
        totalRules,
        activeRules,
        inactiveRules,
        rulesByClasstype,
        rulesBySources,
        uniqueSids: uniqueSids.length,
    };
}
/**
 * Activate/deactivate rule
 * @param id - Rule database ID
 * @param active - Active status to set
 * @returns Updated rule object
 * @throws RuleNotFoundError if rule not found
 */
async function setRuleActive(id, active) {
    return updateRule(id, { isActive: active });
}
/**
 * Create new rule version (same SID, new revision)
 * @param sidToVersion - SID of rule to create new version for
 * @param newRuleText - New rule text
 * @returns Created rule object
 * @throws RuleNotFoundError if original rule not found
 * @throws RuleValidationError if new rule is invalid or SID doesn't match
 */
async function createRuleVersion(sidToVersion, newRuleText) {
    // Validate and parse new rule
    const parsed = validateRuleFormat(newRuleText);
    // Verify SID matches
    if (parsed.sid !== sidToVersion) {
        throw new RuleValidationError(`New rule SID (${parsed.sid}) does not match expected SID (${sidToVersion})`);
    }
    // Get existing rule to verify it exists
    const existingRules = await prisma_1.prisma.rule.findMany({
        where: { sid: sidToVersion },
        orderBy: { rev: 'desc' },
        take: 1,
    });
    if (existingRules.length === 0) {
        throw new RuleNotFoundError(`No rule found with SID ${sidToVersion}`);
    }
    // Get the source from the original rule
    const sourceId = existingRules[0].sourceId;
    // Create new version (revision will be in the new rule text)
    const newRule = await createRule(newRuleText, sourceId || undefined);
    return newRule;
}
/**
 * Get all versions of a rule (same SID, different revisions)
 * @param sid - Snort rule ID
 * @returns Array of rule versions, ordered by revision descending
 */
async function getRuleVersions(sid) {
    const rules = await prisma_1.prisma.rule.findMany({
        where: { sid },
        include: {
            references: true,
            source: true,
        },
        orderBy: {
            rev: 'desc',
        },
    });
    return rules.map(formatRuleResponse);
}
/**
 * Create a new rule source
 * @param name - Source name
 * @param uri - Source URI (URL)
 * @param note - Optional note about source
 * @returns Created rule source object
 * @throws RuleSourceExistsError if source with name already exists
 */
async function createRuleSource(name, uri, note) {
    // Check if source with this name already exists
    const existing = await prisma_1.prisma.ruleSource.findUnique({
        where: { name },
    });
    if (existing) {
        throw new RuleSourceExistsError(name);
    }
    const source = await prisma_1.prisma.ruleSource.create({
        data: {
            name,
            uri,
            note,
        },
    });
    return formatRuleSourceResponse(source);
}
/**
 * Get rule source by ID
 * @param id - Rule source database ID
 * @returns Rule source object with rule count
 * @throws RuleNotFoundError if source not found
 */
async function getRuleSource(id) {
    const source = await prisma_1.prisma.ruleSource.findUnique({
        where: { id },
    });
    if (!source) {
        throw new RuleNotFoundError(`Rule source with ID ${id} not found`);
    }
    return formatRuleSourceResponse(source);
}
/**
 * List all rule sources
 * @returns Array of rule sources with rule counts
 */
async function listRuleSources() {
    const sources = await prisma_1.prisma.ruleSource.findMany({
        orderBy: {
            name: 'asc',
        },
    });
    return Promise.all(sources.map(formatRuleSourceResponse));
}
/**
 * Update rule source
 * @param id - Rule source database ID
 * @param updates - Fields to update (name, uri, note)
 * @returns Updated rule source object
 * @throws RuleNotFoundError if source not found
 */
async function updateRuleSource(id, updates) {
    try {
        const source = await prisma_1.prisma.ruleSource.update({
            where: { id },
            data: updates,
        });
        return formatRuleSourceResponse(source);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            throw new RuleNotFoundError(`Rule source with ID ${id} not found`);
        }
        throw error;
    }
}
/**
 * Delete rule source
 * @param id - Rule source database ID
 * @throws RuleNotFoundError if source not found
 */
async function deleteRuleSource(id) {
    try {
        await prisma_1.prisma.ruleSource.delete({
            where: { id },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            throw new RuleNotFoundError(`Rule source with ID ${id} not found`);
        }
        throw error;
    }
}
/**
 * Format rule database object to response format
 * @param rule - Rule object from Prisma
 * @returns Formatted rule response
 */
function formatRuleResponse(rule) {
    return {
        id: rule.id,
        message: rule.message,
        classtype: rule.classtype,
        sid: rule.sid,
        rev: rule.rev,
        ruleFormat: rule.ruleFormat,
        isActive: rule.isActive,
        notes: rule.notes,
        references: rule.references || [],
        source: rule.source
            ? {
                id: rule.source.id,
                name: rule.source.name,
                uri: rule.source.uri,
            }
            : null,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
    };
}
/**
 * Format rule source database object to response format
 * @param source - Rule source object from Prisma
 * @returns Formatted rule source response
 */
async function formatRuleSourceResponse(source) {
    const ruleCount = await prisma_1.prisma.rule.count({
        where: { sourceId: source.id },
    });
    return {
        id: source.id,
        name: source.name,
        uri: source.uri,
        note: source.note,
        ruleCount,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}
