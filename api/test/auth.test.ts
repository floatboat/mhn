// test/auth.test.ts
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import rootRoutes from '../src/routes';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth API Routes', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;
  const jwtMock = jwt as jest.Mocked<typeof jwt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    app = Fastify();
    await app.register(sensible);
    await app.register(
      async (fastify) => {
        await fastify.register(errorHandler);
        await fastify.register(rootRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      password: '$2b$10$hashedpassword',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return tokens for valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...validUser,
        roles: [{ id: 1, name: 'user', description: 'Regular user', createdAt: new Date(), updatedAt: new Date() }],
      } as never);
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtMock.sign.mockReturnValueOnce('access_token_mock' as never);
      jwtMock.sign.mockReturnValueOnce('refresh_token_mock' as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user).not.toHaveProperty('password');
      expect(body.user.email).toBe('john@example.com');
    });

    it('should return 401 for invalid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'wrong@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Invalid credentials',
      });
    });

    it('should return 403 for inactive user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...validUser,
        active: false,
        roles: [],
      } as never);
      bcryptMock.compare.mockResolvedValue(true as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: 'User account is inactive',
      });
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Validation Error',
      });
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Validation Error',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'invalid-email',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid token', async () => {
      jwtMock.verify.mockReturnValue({ userId: 1, type: 'access' } as never);
      prismaMock.$executeRaw.mockResolvedValue(1 as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Logged out successfully',
      });
    });

    it('should return 401 for missing token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new access token for valid refresh token', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'refresh',
      } as never);
      jwtMock.sign.mockReturnValue('new_access_token' as never);
      prismaMock.$queryRaw.mockResolvedValue([] as never); // Not blacklisted

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'valid_refresh_token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'invalid_token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for expired refresh token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'expired_token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing refreshToken', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return current user info with valid token', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        ...validUser,
        password: 'hashed',
        roles: [{ id: 1, name: 'user', description: null, createdAt: new Date(), updatedAt: new Date() }],
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        id: 1,
        email: 'john@example.com',
        name: 'john_doe',
      });
      expect(body).not.toHaveProperty('password');
      expect(body).toHaveProperty('roles');
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/reset-request', () => {
    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      password: 'hashed',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create password reset token for valid email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(validUser);
      prismaMock.passwdReset.create.mockResolvedValue({
        id: 1,
        hashStr: 'reset_token_hash',
        active: true,
        userId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-request',
        payload: {
          email: 'john@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Password reset email sent',
      });
    });

    it('should return 200 even for non-existent user (security)', async () => {
      // Don't reveal if user exists or not
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-request',
        payload: {
          email: 'nonexistent@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Password reset email sent',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-request',
        payload: {
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/reset-confirm', () => {
    const validResetToken = {
      id: 1,
      hashStr: 'valid_reset_token',
      active: true,
      userId: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    it('should reset password with valid token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(validResetToken);
      prismaMock.user.update.mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        name: 'john_doe',
        password: 'new_hashed_password',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.passwdReset.update.mockResolvedValue({
        ...validResetToken,
        active: false,
      });
      bcryptMock.hash.mockResolvedValue('new_hashed_password' as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-confirm',
        payload: {
          token: 'valid_reset_token',
          newPassword: 'newpassword123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Password reset successfully',
      });
    });

    it('should return 400 for invalid token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-confirm',
        payload: {
          token: 'invalid_token',
          newPassword: 'newpassword123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Invalid or expired reset token',
      });
    });

    it('should return 400 for expired token', async () => {
      const expiredToken = {
        ...validResetToken,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };
      prismaMock.passwdReset.findUnique.mockResolvedValue(expiredToken);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-confirm',
        payload: {
          token: 'expired_token',
          newPassword: 'newpassword123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Invalid or expired reset token',
      });
    });

    it('should return 400 for inactive token', async () => {
      const inactiveToken = {
        ...validResetToken,
        active: false,
      };
      prismaMock.passwdReset.findUnique.mockResolvedValue(inactiveToken);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-confirm',
        payload: {
          token: 'used_token',
          newPassword: 'newpassword123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Invalid or expired reset token',
      });
    });

    it('should return 400 for weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-confirm',
        payload: {
          token: 'valid_token',
          newPassword: '123', // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
