"use strict";
/**
 * Rule Importer Service - Bulk import and manage rule versions from downloaded files
 * Handles parsing multiple rules, version conflict resolution, and atomic imports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleParseError = exports.RuleImportError = void 0;
exports.parseRulesFromFile = parseRulesFromFile;
exports.importRulesFromText = importRulesFromText;
exports.deduplicateRules = deduplicateRules;
exports.getImportStatistics = getImportStatistics;
const prisma_1 = require("../lib/prisma");
const rule_parser_1 = require("../lib/rule-parser");
const rule_service_1 = require("./rule.service");
/**
 * Custom error for import operations
 */
class RuleImportError extends Error {
    constructor(message, failedRules = []) {
        super(message);
        this.failedRules = failedRules;
        this.statusCode = 400;
        this.name = 'RuleImportError';
    }
}
exports.RuleImportError = RuleImportError;
/**
 * Custom error for parsing individual rules
 */
class RuleParseError extends Error {
    constructor(message, lineNumber, ruleText) {
        super(message);
        this.lineNumber = lineNumber;
        this.ruleText = ruleText;
        this.statusCode = 400;
        this.name = 'RuleParseError';
    }
}
exports.RuleParseError = RuleParseError;
/**
 * Parse rules from a file containing multiple rules (one per line)
 */
function parseRulesFromFile(content) {
    const lines = content.split('\n');
    const rules = [];
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        rules.push({
            rawRule: trimmed,
            lineNumber: index + 1,
        });
    });
    return rules;
}
/**
 * Import rules from text content (one rule per line)
 * Handles version conflicts, deduplication, and batching
 */
async function importRulesFromText(ruleFileContent, options) {
    const startTime = new Date();
    const results = {
        totalRules: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: [],
        startTime,
        endTime: startTime,
    };
    try {
        // Parse all rules first
        const parsedRules = parseRulesFromFile(ruleFileContent);
        results.totalRules = parsedRules.length;
        if (parsedRules.length === 0) {
            results.endTime = new Date();
            return results;
        }
        // If rollback enabled, validate ALL rules first before importing any
        if (options.rollbackOnError) {
            const validationErrors = [];
            for (const rule of parsedRules) {
                try {
                    (0, rule_parser_1.parseSnortRule)(rule.rawRule);
                }
                catch (error) {
                    validationErrors.push({
                        lineNumber: rule.lineNumber,
                        ruleText: rule.rawRule.substring(0, 100),
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            if (validationErrors.length > 0) {
                throw new RuleImportError(`Validation failed for ${validationErrors.length} rules. No rules imported.`, validationErrors);
            }
        }
        // Import rules in batches
        for (const rule of parsedRules) {
            try {
                const parsed = (0, rule_parser_1.parseSnortRule)(rule.rawRule);
                // Validate required fields
                if (!parsed.message) {
                    throw new rule_service_1.RuleValidationError('Rule must have a message (msg) option');
                }
                if (!parsed.sid) {
                    throw new rule_service_1.RuleValidationError('Rule must have a SID (sid) option');
                }
                if (!parsed.rev) {
                    throw new rule_service_1.RuleValidationError('Rule must have a revision (rev) option');
                }
                // Check for existing rule
                const existing = await prisma_1.prisma.rule.findFirst({
                    where: {
                        sid: parsed.sid,
                        rev: parsed.rev,
                    },
                });
                if (existing && options.skipIfExist) {
                    results.skipped++;
                    continue;
                }
                if (existing) {
                    results.skipped++;
                    continue; // Already have this exact version
                }
                // Check if newer version exists
                const newerVersion = await prisma_1.prisma.rule.findFirst({
                    where: {
                        sid: parsed.sid,
                        rev: { gt: parsed.rev },
                    },
                });
                if (newerVersion) {
                    results.skipped++;
                    continue; // Don't import older versions
                }
                // Check if this is an update (newer revision of existing SID)
                const oldVersion = await prisma_1.prisma.rule.findFirst({
                    where: {
                        sid: parsed.sid,
                        rev: { lt: parsed.rev },
                    },
                    orderBy: { rev: 'desc' },
                });
                if (oldVersion) {
                    // Deactivate old version
                    await prisma_1.prisma.rule.updateMany({
                        where: { sid: parsed.sid },
                        data: { isActive: false },
                    });
                }
                // Extract references
                const references = (0, rule_parser_1.extractReferences)(parsed);
                // Create new rule
                await prisma_1.prisma.rule.create({
                    data: {
                        message: parsed.message,
                        classtype: parsed.classtype || 'unknown',
                        sid: parsed.sid,
                        rev: parsed.rev,
                        ruleFormat: parsed.rawRule,
                        isActive: options.autoActivate !== false,
                        sourceId: options.sourceId,
                        references: {
                            create: references.map(ref => ({ text: ref })),
                        },
                    },
                });
                if (oldVersion) {
                    results.updated++;
                }
                else {
                    results.imported++;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                results.failed.push({
                    lineNumber: rule.lineNumber,
                    ruleText: rule.rawRule.substring(0, 100),
                    error: errorMessage,
                });
                // If rollback enabled, stop at first error
                if (options.rollbackOnError) {
                    throw new RuleImportError(`Import failed at line ${rule.lineNumber}: ${errorMessage}`, results.failed);
                }
            }
        }
        results.endTime = new Date();
        return results;
    }
    catch (error) {
        results.endTime = new Date();
        if (error instanceof RuleImportError) {
            throw error;
        }
        throw new RuleImportError(`Unexpected error during import: ${error instanceof Error ? error.message : String(error)}`, results.failed);
    }
}
/**
 * Deduplicate rules by content hash
 * Returns only the first occurrence of each unique rule
 */
function deduplicateRules(rules) {
    const seen = new Set();
    const deduped = [];
    rules.forEach(rule => {
        const hash = require('crypto')
            .createHash('md5')
            .update(rule.rawRule)
            .digest('hex');
        if (!seen.has(hash)) {
            seen.add(hash);
            deduped.push({
                ...rule,
                hash,
            });
        }
    });
    return deduped;
}
/**
 * Get statistics about rules and imports
 */
async function getImportStatistics() {
    const [totalRules, activeRules] = await Promise.all([
        prisma_1.prisma.rule.count(),
        prisma_1.prisma.rule.count({ where: { isActive: true } }),
    ]);
    // Note: RuleFetchJob is tracked in rule-fetcher-job.service
    return {
        totalRules,
        activeRules,
        totalImportJobs: 0, // Will be populated by fetcher-job service
        successfulJobs: 0,
        failedJobs: 0,
        totalRulesImported: 0,
    };
}
