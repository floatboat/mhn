// src/types/auth.types.ts

/**
 * Login request body
 */
export interface LoginRequestBody {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    roles: string[];
  };
}

/**
 * Refresh token request body
 */
export interface RefreshRequestBody {
  refreshToken: string;
}

/**
 * Refresh token response
 */
export interface RefreshResponse {
  accessToken: string;
}

/**
 * Password reset request body
 */
export interface ResetRequestBody {
  email: string;
}

/**
 * Password reset confirm body
 */
export interface ResetConfirmBody {
  token: string;
  newPassword: string;
}

/**
 * User info response (for /api/auth/me)
 */
export interface UserInfoResponse {
  id: number;
  email: string;
  name: string;
  active: boolean;
  confirmedAt: string | null;
  createdAt: string;
  roles: string[];
}

// JSON Schemas for request validation

/**
 * Schema for login request
 */
export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      password: {
        type: 'string',
        minLength: 6,
        description: 'User password (minimum 6 characters)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' },
            roles: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Schema for refresh token request
 */
export const logoutSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        description: 'Refresh token to invalidate',
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

export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        description: 'Refresh token obtained from login',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Schema for password reset request
 */
export const resetRequestSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address of account to reset',
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
 * Schema for password reset confirmation
 */
export const resetConfirmSchema = {
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: {
        type: 'string',
        minLength: 40,
        maxLength: 40,
        description: 'Password reset token (40 characters)',
      },
      newPassword: {
        type: 'string',
        minLength: 6,
        description: 'New password (minimum 6 characters)',
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
 * Schema for user info response
 */
export const userInfoSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        name: { type: 'string' },
        active: { type: 'boolean' },
        confirmedAt: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        roles: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
} as const;
