// test/auth.guards.test.ts
// Set up environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.DEPLOY_KEY = 'test-deploy-key';
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});
jest.mock('jsonwebtoken');

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import {
  requireAuth,
  requireRole,
  requireApiKey,
  requireDeployKey,
} from '../src/decorators/auth.decorators';

describe('Auth Guards', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const jwtMock = jwt as jest.Mocked<typeof jwt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    app = Fastify();
    await app.register(sensible);
    await app.register(errorHandler);

    // Register test routes with different guards
    app.get('/test/public', async () => {
      return { message: 'public route' };
    });

    // Mock route that requires authentication
    app.get(
      '/test/protected',
      {
        preHandler: requireAuth,
      },
      async () => {
        return { message: 'protected route' };
      },
    );

    // Mock route that requires admin role
    app.get(
      '/test/admin',
      {
        preHandler: [requireAuth, requireRole('admin')],
      },
      async () => {
        return { message: 'admin route' };
      },
    );

    // Mock route that requires API key
    app.get(
      '/test/apikey',
      {
        preHandler: requireApiKey,
      },
      async () => {
        return { message: 'apikey route' };
      },
    );

    // Mock route that requires deploy key
    app.post(
      '/test/deploy',
      {
        preHandler: requireDeployKey,
      },
      async () => {
        return { message: 'deploy route' };
      },
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('requireAuth (JWT verification)', () => {
    it('should allow access with valid JWT', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        name: 'john_doe',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'protected route',
      });
    });

    it('should block access without JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });

    it('should block access with invalid JWT', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should block access with expired JWT', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: 'Bearer expired_token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });

    it('should block access with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: {
          authorization: 'InvalidFormat',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('requireRole (RBAC)', () => {
    it('should allow access for admin user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        type: 'access',
      } as never);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'admin@example.com',
        name: 'admin',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            id: 1,
            name: 'admin',
            description: 'Administrator',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/test/admin',
        headers: {
          authorization: 'Bearer admin_token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'admin route',
      });
    });

    it('should block access for non-admin user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 2,
        email: 'user@example.com',
        type: 'access',
      } as never);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 2,
        email: 'user@example.com',
        name: 'user',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            id: 2,
            name: 'user',
            description: 'Regular user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/test/admin',
        headers: {
          authorization: 'Bearer user_token',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: 'Forbidden',
      });
    });

    it('should block unauthenticated users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/admin',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('requireApiKey', () => {
    const validApiKey = {
      id: 1,
      apiKey: 'valid_api_key_32_chars_here',
      userId: 1,
      createdAt: new Date(),
    };

    it('should allow access with valid API key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        ...validApiKey,
        user: {
          id: 1,
          email: 'john@example.com',
          name: 'john_doe',
          password: 'hashed',
          active: true,
          confirmedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          roles: [],
        },
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/test/apikey?api_key=valid_api_key_32_chars_here',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'apikey route',
      });
    });

    it('should block access with invalid API key', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/test/apikey?api_key=invalid_api_key',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });

    it('should block access without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/apikey',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should block access if user is inactive', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue({
        ...validApiKey,
        user: {
          id: 1,
          email: 'john@example.com',
          name: 'john_doe',
          password: 'hashed',
          active: false, // Inactive user
          confirmedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          roles: [],
        },
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/test/apikey?api_key=valid_api_key_32_chars_here',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });
  });

  describe('requireDeployKey', () => {
    const correctDeployKey = 'test_deploy_key_from_env';

    beforeAll(() => {
      // Mock environment variable
      process.env.DEPLOY_KEY = correctDeployKey;
    });

    afterAll(() => {
      delete process.env.DEPLOY_KEY;
    });

    it('should allow access with valid deploy key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/test/deploy?deploy_key=${correctDeployKey}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'deploy route',
      });
    });

    it('should block access with invalid deploy key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test/deploy?deploy_key=wrong_deploy_key',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });

    it('should block access without deploy key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test/deploy',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('public routes', () => {
    it('should allow access to public routes without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/public',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'public route',
      });
    });
  });
});
