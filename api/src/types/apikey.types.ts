// src/types/apikey.types.ts

/**
 * API Key response
 */
export interface ApiKeyResponse {
  id: number;
  apiKey: string;
  createdAt: string;
  userId: number;
}

/**
 * API Key list item (includes user info)
 */
export interface ApiKeyListItem {
  id: number;
  apiKey: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

// JSON Schemas for request validation

/**
 * Schema for listing API keys (admin only)
 */
export const listApiKeysSchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          apiKey: { type: 'string' },
          createdAt: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Schema for creating API key
 */
export const createApiKeySchema = {
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        apiKey: { type: 'string' },
        createdAt: { type: 'string' },
        userId: { type: 'number' },
      },
    },
  },
} as const;

/**
 * Schema for deleting API key
 */
export const deleteApiKeySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'API Key ID',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
} as const;
