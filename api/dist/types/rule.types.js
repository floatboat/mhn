"use strict";
// src/types/rule.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRulesSchema = exports.deleteRuleSourceSchema = exports.deleteRuleSchema = exports.listRuleSourcesSchema = exports.getRuleSourceSchema = exports.updateRuleSourceSchema = exports.createRuleSourceSchema = exports.listRulesSchema = exports.getRuleSchema = exports.updateRuleSchema = exports.createRuleSchema = void 0;
/**
 * JSON Schema for creating rules
 */
exports.createRuleSchema = {
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
};
/**
 * JSON Schema for updating rules
 */
exports.updateRuleSchema = {
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
};
/**
 * JSON Schema for getting a rule
 */
exports.getRuleSchema = {
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
};
/**
 * JSON Schema for listing rules
 */
exports.listRulesSchema = {
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
};
/**
 * JSON Schema for creating rule sources
 */
exports.createRuleSourceSchema = {
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
};
/**
 * JSON Schema for updating rule sources
 */
exports.updateRuleSourceSchema = {
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
};
/**
 * JSON Schema for getting a rule source
 */
exports.getRuleSourceSchema = {
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
};
/**
 * JSON Schema for listing rule sources
 */
exports.listRuleSourcesSchema = {
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
};
/**
 * JSON Schema for deleting a rule
 */
exports.deleteRuleSchema = {
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
};
/**
 * JSON Schema for deleting a rule source
 */
exports.deleteRuleSourceSchema = {
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
};
/**
 * JSON Schema for exporting rules
 */
exports.exportRulesSchema = {
    response: {
        200: {
            type: 'string',
            description: 'Snort rule format text file',
        },
    },
};
