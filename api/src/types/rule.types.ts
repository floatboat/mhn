// src/types/rule.types.ts

/**
 * Snort/Suricata rule structure
 */
export interface RuleRecord {
  id: number;
  message: string;
  classtype: string;
  sid: number;
  rev: number;
  ruleFormat: string;
  isActive: boolean;
  notes?: string | null;
  sourceId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rule with references populated
 */
export interface RuleWithReferences extends RuleRecord {
  references: Array<{
    id: number;
    text: string;
  }>;
}

/**
 * Rule with source populated
 */
export interface RuleWithSource extends RuleRecord {
  source?: {
    id: number;
    name: string;
    uri: string;
  } | null;
}

/**
 * Complete rule with all relations
 */
export interface RuleComplete extends RuleRecord {
  references: Array<{
    id: number;
    text: string;
  }>;
  source?: {
    id: number;
    name: string;
    uri: string;
  } | null;
}

/**
 * Rule creation request
 */
export interface CreateRuleRequest {
  message: string;
  classtype: string;
  sid: number;
  rev: number;
  ruleFormat: string;
  references?: string[]; // Array of CVEs/URLs
  notes?: string;
  sourceId?: number;
}

/**
 * Rule update request
 */
export interface UpdateRuleRequest {
  message?: string;
  classtype?: string;
  notes?: string;
  isActive?: boolean;
  ruleFormat?: string;
  sourceId?: number;
}

/**
 * Rule response DTO
 */
export interface RuleResponse {
  id: number;
  message: string;
  classtype: string;
  sid: number;
  rev: number;
  references: string[];
  notes?: string;
  isActive: boolean;
  source?: {
    id: number;
    name: string;
  } | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Rule source record
 */
export interface RuleSourceRecord {
  id: number;
  name: string;
  uri: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rule source creation request
 */
export interface CreateRuleSourceRequest {
  name: string;
  uri: string;
  note?: string;
}

/**
 * Rule source update request
 */
export interface UpdateRuleSourceRequest {
  name?: string;
  uri?: string;
  note?: string;
}

/**
 * Rule source response DTO
 */
export interface RuleSourceResponse {
  id: number;
  name: string;
  uri: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * JSON Schema for creating rules
 */
export const createRuleSchema = {
  body: {
    type: 'object',
    required: ['message', 'classtype', 'sid', 'rev', 'ruleFormat'],
    properties: {
      message: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'Human-readable rule description',
      },
      classtype: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Classification (e.g., attempted-admin)',
      },
      sid: {
        type: 'integer',
        minimum: 1,
        description: 'Snort Rule ID',
      },
      rev: {
        type: 'integer',
        minimum: 1,
        description: 'Revision number',
      },
      ruleFormat: {
        type: 'string',
        minLength: 10,
        description: 'Rule text (Snort/Suricata format)',
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description: 'CVE numbers, URLs, etc.',
      },
      notes: {
        type: 'string',
        maxLength: 5000,
        description: 'Optional notes',
      },
      sourceId: {
        type: 'integer',
        minimum: 1,
        description: 'Optional rule source ID',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        message: { type: 'string' },
        classtype: { type: 'string' },
        sid: { type: 'number' },
        rev: { type: 'number' },
        references: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for updating rules
 */
export const updateRuleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule ID',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
      },
      classtype: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      notes: {
        type: 'string',
        maxLength: 5000,
      },
      isActive: {
        type: 'boolean',
      },
      ruleFormat: {
        type: 'string',
        minLength: 10,
      },
      sourceId: {
        type: 'integer',
        minimum: 1,
        nullable: true,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        message: { type: 'string' },
        classtype: { type: 'string' },
        sid: { type: 'number' },
        rev: { type: 'number' },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for getting a rule
 */
export const getRuleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule ID',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        message: { type: 'string' },
        classtype: { type: 'string' },
        sid: { type: 'number' },
        rev: { type: 'number' },
        references: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
        isActive: { type: 'boolean' },
        source: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for listing rules
 */
export const listRulesSchema = {
  querystring: {
    type: 'object',
    properties: {
      isActive: {
        type: 'string',
        enum: ['true', 'false'],
        description: 'Filter by active status',
      },
      classtype: {
        type: 'string',
        description: 'Filter by classtype',
      },
      limit: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Maximum number of results',
      },
      offset: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Number of results to skip',
      },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          message: { type: 'string' },
          classtype: { type: 'string' },
          sid: { type: 'number' },
          rev: { type: 'number' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string' },
        },
      },
    },
  },
} as const;

/**
 * JSON Schema for creating rule sources
 */
export const createRuleSourceSchema = {
  body: {
    type: 'object',
    required: ['name', 'uri'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: 'Rule source name',
      },
      uri: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        format: 'uri',
        description: 'URL to download rules from',
      },
      note: {
        type: 'string',
        maxLength: 1000,
        description: 'Optional notes',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        uri: { type: 'string' },
        note: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for updating rule sources
 */
export const updateRuleSourceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule source ID',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
      },
      uri: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        format: 'uri',
      },
      note: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        uri: { type: 'string' },
        note: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for getting a rule source
 */
export const getRuleSourceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule source ID',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        uri: { type: 'string' },
        note: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * JSON Schema for listing rule sources
 */
export const listRuleSourcesSchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          uri: { type: 'string' },
          note: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
    },
  },
} as const;

/**
 * JSON Schema for deleting a rule
 */
export const deleteRuleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule ID',
      },
    },
  },
  response: {
    204: {
      type: 'null',
    },
  },
} as const;

/**
 * JSON Schema for deleting a rule source
 */
export const deleteRuleSourceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Rule source ID',
      },
    },
  },
  response: {
    204: {
      type: 'null',
    },
  },
} as const;

/**
 * JSON Schema for exporting rules
 */
export const exportRulesSchema = {
  response: {
    200: {
      type: 'string',
      description: 'Snort rule format text file',
    },
  },
} as const;
