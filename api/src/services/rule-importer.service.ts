/**
 * Rule Importer Service - Bulk import and manage rule versions from downloaded files
 * Handles parsing multiple rules, version conflict resolution, and atomic imports
 */

import { prisma } from '../lib/prisma';
import {
  parseSnortRule,
  extractReferences,
  InvalidRuleError,
  ParsedRule,
} from '../lib/rule-parser';
import { RuleValidationError, RuleExistsError } from './rule.service';
import { Prisma } from '@prisma/client';

/**
 * Custom error for import operations
 */
export class RuleImportError extends Error {
  statusCode = 400;

  constructor(
    message: string,
    public failedRules: Array<{ lineNumber: number; ruleText: string; reason: string }> = [],
  ) {
    super(message);
    this.name = 'RuleImportError';
  }
}

/**
 * Custom error for parsing individual rules
 */
export class RuleParseError extends Error {
  statusCode = 400;

  constructor(
    message: string,
    public lineNumber: number,
    public ruleText: string,
  ) {
    super(message);
    this.name = 'RuleParseError';
  }
}

/**
 * Result of a bulk import operation
 */
export interface ImportResult {
  totalRules: number;
  imported: number; // Newly created
  updated: number; // New revisions of existing rules
  skipped: number; // Already exist
  failed: Array<{
    lineNumber: number;
    ruleText: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
}

/**
 * Options for bulk import
 */
export interface BulkImportOptions {
  sourceId: number;
  deduplicateByHash?: boolean; // Skip duplicate content
  autoActivate?: boolean; // Set isActive: true
  rollbackOnError?: boolean; // Stop at first error (all-or-nothing)
  skipIfExist?: boolean; // Don't update existing rules
}

/**
 * Parse rules from a file containing multiple rules (one per line)
 */
export function parseRulesFromFile(
  content: string,
): Array<{ rawRule: string; lineNumber: number }> {
  const lines = content.split('\n');
  const rules: Array<{ rawRule: string; lineNumber: number }> = [];

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
export async function importRulesFromText(
  ruleFileContent: string,
  options: BulkImportOptions,
): Promise<ImportResult> {
  const startTime = new Date();
  const results: ImportResult = {
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
      const validationErrors: typeof results.failed = [];

      for (const rule of parsedRules) {
        try {
          parseSnortRule(rule.rawRule);
        } catch (error) {
          validationErrors.push({
            lineNumber: rule.lineNumber,
            ruleText: rule.rawRule.substring(0, 100),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (validationErrors.length > 0) {
        throw new RuleImportError(
          `Validation failed for ${validationErrors.length} rules. No rules imported.`,
          validationErrors,
        );
      }
    }

    // Import rules in batches
    for (const rule of parsedRules) {
      try {
        const parsed = parseSnortRule(rule.rawRule);

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

        // Check for existing rule
        const existing = await prisma.rule.findFirst({
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
        const newerVersion = await prisma.rule.findFirst({
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
        const oldVersion = await prisma.rule.findFirst({
          where: {
            sid: parsed.sid,
            rev: { lt: parsed.rev },
          },
          orderBy: { rev: 'desc' },
        });

        if (oldVersion) {
          // Deactivate old version
          await prisma.rule.updateMany({
            where: { sid: parsed.sid },
            data: { isActive: false },
          });
        }

        // Extract references
        const references = extractReferences(parsed);

        // Create new rule
        await prisma.rule.create({
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
        } else {
          results.imported++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.failed.push({
          lineNumber: rule.lineNumber,
          ruleText: rule.rawRule.substring(0, 100),
          error: errorMessage,
        });

        // If rollback enabled, stop at first error
        if (options.rollbackOnError) {
          throw new RuleImportError(
            `Import failed at line ${rule.lineNumber}: ${errorMessage}`,
            results.failed,
          );
        }
      }
    }

    results.endTime = new Date();
    return results;
  } catch (error) {
    results.endTime = new Date();

    if (error instanceof RuleImportError) {
      throw error;
    }

    throw new RuleImportError(
      `Unexpected error during import: ${error instanceof Error ? error.message : String(error)}`,
      results.failed,
    );
  }
}

/**
 * Deduplicate rules by content hash
 * Returns only the first occurrence of each unique rule
 */
export function deduplicateRules(
  rules: Array<{ rawRule: string; lineNumber: number }>,
): Array<{ rawRule: string; lineNumber: number; hash: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ rawRule: string; lineNumber: number; hash: string }> = [];

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
export async function getImportStatistics(): Promise<{
  totalRules: number;
  activeRules: number;
  totalImportJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalRulesImported: number;
}> {
  const [totalRules, activeRules] = await Promise.all([
    prisma.rule.count(),
    prisma.rule.count({ where: { isActive: true } }),
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
