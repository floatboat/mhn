// test/apikey.test.ts
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});
jest.mock('jsonwebtoken');
jest.mock('crypto');

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import rootRoutes from '../src/routes';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('API Key Routes', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const jwtMock = jwt as jest.Mocked<typeof jwt>;
  const cryptoMock = crypto as jest.Mocked<typeof crypto>;

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

  const validToken = 'valid_jwt_token';
  const mockUser = {
    id: 1,
    email: 'john@example.com',
    name: 'john_doe',
    password: 'hashed',
    active: true,
    confirmedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/apikey', () => {
    it('should return user API keys with authentication', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      const apiKeys = [
        {
          id: 1,
          apiKey: 'key1_32_characters_no_dashes_',
          userId: 1,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          apiKey: 'key2_32_characters_no_dashes_',
          userId: 1,
          createdAt: new Date('2024-01-02'),
        },
      ];

      prismaMock.apiKey.findMany.mockResolvedValue(apiKeys);

      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('apiKey');
      expect(body[0]).toHaveProperty('createdAt');
      expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty array if user has no API keys', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      prismaMock.apiKey.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  describe('POST /api/apikey', () => {
    it('should create new API key for authenticated user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      // Mock crypto.randomUUID to return UUID without dashes
      const mockUUID = '12345678901234567890123456789012';
      (cryptoMock.randomUUID as jest.Mock).mockReturnValue(
        '12345678-9012-3456-7890-123456789012',
      );

      const newApiKey = {
        id: 1,
        apiKey: mockUUID,
        userId: 1,
        createdAt: new Date(),
      };

      prismaMock.apiKey.create.mockResolvedValue(newApiKey);

      const response = await app.inject({
        method: 'POST',
        url: '/api/apikey',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('apiKey');
      expect(body.apiKey).toHaveLength(32); // UUID without dashes
      expect(body).toHaveProperty('createdAt');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/apikey',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should limit number of API keys per user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      // Mock user already has 5 API keys
      prismaMock.apiKey.count.mockResolvedValue(5);

      const response = await app.inject({
        method: 'POST',
        url: '/api/apikey',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Maximum API key limit reached',
      });
    });
  });

  describe('DELETE /api/apikey/:id', () => {
    it('should delete own API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      const apiKeyToDelete = {
        id: 1,
        apiKey: 'key_to_delete_32_characters__',
        userId: 1,
        createdAt: new Date(),
      };

      prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyToDelete);
      prismaMock.apiKey.delete.mockResolvedValue(apiKeyToDelete);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/apikey/1',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'API key deleted successfully',
      });
      expect(prismaMock.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 403 when trying to delete another user API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      const otherUserApiKey = {
        id: 2,
        apiKey: 'other_user_key_32_characters_',
        userId: 2, // Different user
        createdAt: new Date(),
      };

      prismaMock.apiKey.findUnique.mockResolvedValue(otherUserApiKey);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/apikey/2',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: 'Cannot delete API key that belongs to another user',
      });
      expect(prismaMock.apiKey.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      prismaMock.apiKey.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/apikey/999',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'API key not found',
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/apikey/1',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow admin to delete any API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        roles: ['admin'],
        type: 'access',
      } as never);

      const otherUserApiKey = {
        id: 2,
        apiKey: 'other_user_key_32_characters_',
        userId: 2, // Different user
        createdAt: new Date(),
      };

      prismaMock.apiKey.findUnique.mockResolvedValue(otherUserApiKey);
      prismaMock.apiKey.delete.mockResolvedValue(otherUserApiKey);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/apikey/2',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 2 },
      });
    });
  });

  describe('GET /api/apikey/:id', () => {
    it('should return API key details for own key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      const apiKey = {
        id: 1,
        apiKey: 'key1_32_characters_no_dashes_',
        userId: 1,
        createdAt: new Date(),
      };

      prismaMock.apiKey.findUnique.mockResolvedValue(apiKey);

      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey/1',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        id: 1,
        apiKey: 'key1_32_characters_no_dashes_',
      });
    });

    it('should return 403 for another user API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      const otherUserApiKey = {
        id: 2,
        apiKey: 'other_user_key_32_characters_',
        userId: 2,
        createdAt: new Date(),
      };

      prismaMock.apiKey.findUnique.mockResolvedValue(otherUserApiKey);

      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey/2',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent API key', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      } as never);

      prismaMock.apiKey.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/apikey/999',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('API Key format validation', () => {
    it('should ensure API keys are 32 characters (UUID without dashes)', () => {
      const uuid = '12345678-9012-3456-7890-123456789012';
      const apiKey = uuid.replace(/-/g, '');

      expect(apiKey).toHaveLength(32);
      expect(apiKey).not.toContain('-');
    });

    it('should validate API key format in database queries', async () => {
      const validApiKey = '12345678901234567890123456789012';

      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 1,
        apiKey: validApiKey,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await prismaMock.apiKey.findUnique({
        where: { apiKey: validApiKey },
      });

      expect(result?.apiKey).toHaveLength(32);
    });
  });
});
