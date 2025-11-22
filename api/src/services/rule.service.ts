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

import { prisma } from '../lib/prisma';
import {
  parseSnortRule,
  extractReferences,
  InvalidRuleError,
  ParsedRule,
} from '../lib/rule-parser';
import { Prisma } from '@prisma/client';

/**
 * Custom error for rule validation failures
 */
export class RuleValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'RuleValidationError';
  }
}

/**
 * Custom error for rule already exists
 */
export class RuleExistsError extends Error {
  statusCode = 409;
  constructor(sid: number, rev: number) {
    super(`Rule with SID ${sid} revision ${rev} already exists`);
    this.name = 'RuleExistsError';
  }
}

/**
 * Custom error for rule not found
 */
export class RuleNotFoundError extends Error {
  statusCode = 404;
  constructor(message: string = 'Rule not found') {
    super(message);
    this.name = 'RuleNotFoundError';
  }
}

/**
 * Custom error for rule source already exists
 */
export class RuleSourceExistsError extends Error {
  statusCode = 409;
  constructor(name: string) {
    super(`Rule source '${name}' already exists`);
    this.name = 'RuleSourceExistsError';
  }
}

/**
 * Rule response interface
 */
export interface RuleResponse {
  id: number;
  message: string;
  classtype: string;
  sid: number;
  rev: number;
  ruleFormat: string;
  isActive: boolean;
  notes?: string | null;
  references: Array<{ id: number; text: string }>;
  source?: {
    id: number;
    name: string;
    uri: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rule source response interface
 */
export interface RuleSourceResponse {
  id: number;
  name: string;
  uri: string;
  note?: string | null;
  ruleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rule statistics interface
 */
export interface RuleStatistics {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  rulesByClasstype: Array<{ classtype: string; count: number }>;
  rulesBySources: Array<{ sourceName: string; count: number }>;
  uniqueSids: number;
}

/**
 * Rule filters for querying
 */
export interface RuleFilters {
  isActive?: boolean;
  classtype?: string;
  sourceId?: number;
  search?: string; // Search in message
  limit?: number;
  offset?: number;
}

/**
 * Validate rule format and required fields
 * @param ruleText - Snort rule text to validate
 * @throws RuleValidationError if validation fails
 */
export function validateRuleFormat(ruleText: string): ParsedRule {
  if (!ruleText || !ruleText.trim()) {
    throw new RuleValidationError('Rule text cannot be empty');
  }

  try {
    const parsed = parseSnortRule(ruleText);

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
      throw new RuleValidationError(
        'Rule must have a classtype (classtype) option',
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof InvalidRuleError) {
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
export async function createRule(
  ruleText: string,
  sourceId?: number,
): Promise<RuleResponse> {
  // Validate and parse rule
  const parsed = validateRuleFormat(ruleText);

  // Check if rule already exists
  const existing = await prisma.rule.findUnique({
    where: {
      sid_rev: {
        sid: parsed.sid!,
        rev: parsed.rev!,
      },
    },
  });

  if (existing) {
    throw new RuleExistsError(parsed.sid!, parsed.rev!);
  }

  // Extract references
  const references = extractReferences(parsed);

  // Create rule with references
  const rule = await prisma.rule.create({
    data: {
      message: parsed.message!,
      classtype: parsed.classtype!,
      sid: parsed.sid!,
      rev: parsed.rev!,
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
export async function getRuleById(id: number): Promise<RuleResponse> {
  const rule = await prisma.rule.findUnique({
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
export async function getRuleBySid(
  sid: number,
  rev?: number,
): Promise<RuleResponse> {
  let rule;

  if (rev !== undefined) {
    // Get specific revision
    rule = await prisma.rule.findUnique({
      where: {
        sid_rev: { sid, rev },
      },
      include: {
        references: true,
        source: true,
      },
    });
  } else {
    // Get latest revision
    const rules = await prisma.rule.findMany({
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
    throw new RuleNotFoundError(
      `Rule with SID ${sid}${rev !== undefined ? ` revision ${rev}` : ''} not found`,
    );
  }

  return formatRuleResponse(rule);
}

/**
 * List all rules with filtering and pagination
 * @param filters - Optional filters (isActive, classtype, sourceId, search, limit, offset)
 * @returns Object with rules array and total count
 */
export async function listRules(
  filters?: RuleFilters,
): Promise<{ rules: RuleResponse[]; total: number }> {
  const where: Prisma.RuleWhereInput = {};

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

  const total = await prisma.rule.count({ where });

  const rules = await prisma.rule.findMany({
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
export async function updateRule(
  id: number,
  updates: {
    notes?: string;
    isActive?: boolean;
  },
): Promise<RuleResponse> {
  // Verify rule exists
  const existing = await prisma.rule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new RuleNotFoundError(`Rule with ID ${id} not found`);
  }

  const rule = await prisma.rule.update({
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
export async function deleteRule(id: number): Promise<void> {
  try {
    await prisma.rule.delete({
      where: { id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
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
export async function addRuleReference(
  ruleId: number,
  referenceText: string,
): Promise<{ id: number; text: string; ruleId: number }> {
  // Verify rule exists
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
  });

  if (!rule) {
    throw new RuleNotFoundError(`Rule with ID ${ruleId} not found`);
  }

  const reference = await prisma.reference.create({
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
export async function removeRuleReference(referenceId: number): Promise<void> {
  try {
    await prisma.reference.delete({
      where: { id: referenceId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
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
export async function searchRules(
  query: string,
  limit: number = 20,
): Promise<RuleResponse[]> {
  const rules = await prisma.rule.findMany({
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
export async function getRulesByClasstype(
  classtype: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ rules: RuleResponse[]; total: number }> {
  const where = { classtype };

  const total = await prisma.rule.count({ where });

  const rules = await prisma.rule.findMany({
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
export async function getRuleStatistics(): Promise<RuleStatistics> {
  const totalRules = await prisma.rule.count();
  const activeRules = await prisma.rule.count({ where: { isActive: true } });
  const inactiveRules = await prisma.rule.count({ where: { isActive: false } });

  // Rules by classtype
  const classtypeCounts = await prisma.rule.groupBy({
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
  const sourceCounts = await prisma.rule.groupBy({
    by: ['sourceId'],
    where: {
      sourceId: { not: null },
    },
    _count: {
      sourceId: true,
    },
  });

  const rulesBySources: Array<{ sourceName: string; count: number }> = [];
  for (const sc of sourceCounts) {
    if (sc.sourceId) {
      const source = await prisma.ruleSource.findUnique({
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
  const uniqueSids = await prisma.rule.findMany({
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
export async function setRuleActive(
  id: number,
  active: boolean,
): Promise<RuleResponse> {
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
export async function createRuleVersion(
  sidToVersion: number,
  newRuleText: string,
): Promise<RuleResponse> {
  // Validate and parse new rule
  const parsed = validateRuleFormat(newRuleText);

  // Verify SID matches
  if (parsed.sid !== sidToVersion) {
    throw new RuleValidationError(
      `New rule SID (${parsed.sid}) does not match expected SID (${sidToVersion})`,
    );
  }

  // Get existing rule to verify it exists
  const existingRules = await prisma.rule.findMany({
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
export async function getRuleVersions(sid: number): Promise<RuleResponse[]> {
  const rules = await prisma.rule.findMany({
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
export async function createRuleSource(
  name: string,
  uri: string,
  note?: string,
): Promise<RuleSourceResponse> {
  // Check if source with this name already exists
  const existing = await prisma.ruleSource.findUnique({
    where: { name },
  });

  if (existing) {
    throw new RuleSourceExistsError(name);
  }

  const source = await prisma.ruleSource.create({
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
export async function getRuleSource(id: number): Promise<RuleSourceResponse> {
  const source = await prisma.ruleSource.findUnique({
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
export async function listRuleSources(): Promise<RuleSourceResponse[]> {
  const sources = await prisma.ruleSource.findMany({
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
export async function updateRuleSource(
  id: number,
  updates: { name?: string; uri?: string; note?: string },
): Promise<RuleSourceResponse> {
  try {
    const source = await prisma.ruleSource.update({
      where: { id },
      data: updates,
    });

    return formatRuleSourceResponse(source);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
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
export async function deleteRuleSource(id: number): Promise<void> {
  try {
    await prisma.ruleSource.delete({
      where: { id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
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
function formatRuleResponse(rule: any): RuleResponse {
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
async function formatRuleSourceResponse(
  source: any,
): Promise<RuleSourceResponse> {
  const ruleCount = await prisma.rule.count({
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
