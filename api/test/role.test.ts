// test/role.test.ts
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
import rootRoutes from '../src/routes';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';

describe('Role API Routes', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
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

  const adminToken = 'admin_token';
  const userToken = 'user_token';

  describe('GET /api/role', () => {
    const roles = [
      {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 3,
        },
      },
      {
        id: 2,
        name: 'user',
        description: 'Regular user role',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 10,
        },
      },
    ];

    it('should return all roles with valid authentication', async () => {
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findMany.mockResolvedValue(roles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/role',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('name');
      expect(body[0]).toHaveProperty('description');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/role',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/role', () => {
    it('should create role as admin', async () => {
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue(null); // Role doesn't exist
      prismaMock.role.create.mockResolvedValue({
        id: 3,
        name: 'moderator',
        description: 'Moderator role',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/role',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'moderator',
          description: 'Moderator role',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toMatchObject({
        name: 'moderator',
        description: 'Moderator role',
      });
    });

    it('should return 403 for non-admin user', async () => {
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
        roles: [{
          id: 2,
          name: 'user',
          description: 'Regular user',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/role',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          name: 'moderator',
          description: 'Moderator role',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 for duplicate role name', async () => {
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        name: 'admin',
        description: 'Administrator',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/role',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'admin',
          description: 'Duplicate admin',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "Role 'admin' already exists",
      });
    });

    it('should return 400 for missing name', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        roles: ['admin'],
        type: 'access',
      } as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/role',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          description: 'Role without name',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/role/:roleId/assign/:userId', () => {
    it('should assign role to user as admin', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        type: 'access',
      } as never);

      // First call: auth guard fetches logged-in admin user
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 1,
        email: 'admin@example.com',
        name: 'admin',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      // Second call: handler fetches target user to assign role
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 3,
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 2,
        name: 'user',
        description: 'Regular user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.user.update.mockResolvedValue({
        id: 3,
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/role/2/assign/3',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: "Role 'user' assigned to user successfully",
      });
    });

    it('should return 403 for non-admin user', async () => {
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
        roles: [{
          id: 2,
          name: 'user',
          description: 'Regular user',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      const response = await app.inject({
        method: 'POST',
        url: '/api/role/2/assign/3',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent role', async () => {
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/role/999/assign/3',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Role not found',
      });
    });

    it('should return 404 for non-existent user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        type: 'access',
      } as never);

      // First call: auth guard fetches logged-in admin
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 1,
        email: 'admin@example.com',
        name: 'admin',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      // Second call: handler tries to fetch target user (doesn't exist)
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 2,
        name: 'user',
        description: 'Regular user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/role/2/assign/999',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'User not found',
      });
    });
  });

  describe('DELETE /api/role/:roleId/assign/:userId', () => {
    it('should remove role from user as admin', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        roles: ['admin'],
        type: 'access',
      } as never);

      // First call: auth decorator fetches admin user
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 1,
        email: 'admin@example.com',
        name: 'admin',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 2,
        name: 'user',
        description: 'Regular user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Second call: handler fetches target user to remove role from
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 3,
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{
          id: 2,
          name: 'user',
          description: 'Regular user',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.user.update.mockResolvedValue({
        id: 3,
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/role/2/assign/3',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: "Role 'user' removed from user successfully",
      });
    });

    it('should return 403 for non-admin user', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 2,
        email: 'user@example.com',
        roles: ['user'],
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
        roles: [{
          id: 2,
          name: 'user',
          description: 'Regular user',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/role/2/assign/3',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/role/:id', () => {
    it('should return role details with valid authentication', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        roles: ['admin'],
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 5,
        },
      } as never);

      const response = await app.inject({
        method: 'GET',
        url: '/api/role/1',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        name: 'admin',
        description: 'Administrator role',
        userCount: 5,
      });
    });

    it('should return 404 for non-existent role', async () => {
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'admin@example.com',
        roles: ['admin'],
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
        roles: [{
          id: 1,
          name: 'admin',
          description: 'Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      } as never);

      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/role/999',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
