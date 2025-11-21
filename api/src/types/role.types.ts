// src/types/role.types.ts

/**
 * Create role request body
 */
export interface CreateRoleBody {
  name: string;
  description?: string;
}

/**
 * Update role request body
 */
export interface UpdateRoleBody {
  description?: string;
}

/**
 * Role response
 */
export interface RoleResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role with user count
 */
export interface RoleWithUserCount extends RoleResponse {
  userCount: number;
}

// JSON Schemas for request validation

/**
 * Schema for creating a role
 */
export const createRoleSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 50,
        pattern: '^[a-z_]+$',
        description: 'Role name (lowercase letters and underscores only)',
      },
      description: {
        type: 'string',
        maxLength: 255,
        description: 'Optional role description',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Schema for updating a role
 */
export const updateRoleSchema = {
  body: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        maxLength: 255,
        description: 'Role description',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Schema for listing roles
 */
export const listRolesSchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          userCount: { type: 'number' },
        },
      },
    },
  },
} as const;

/**
 * Schema for assigning role to user
 */
export const assignRoleSchema = {
  params: {
    type: 'object',
    required: ['roleId', 'userId'],
    properties: {
      roleId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Role ID',
      },
      userId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'User ID',
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

/**
 * Schema for removing role from user
 */
export const removeRoleSchema = {
  params: {
    type: 'object',
    required: ['roleId', 'userId'],
    properties: {
      roleId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Role ID',
      },
      userId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'User ID',
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
