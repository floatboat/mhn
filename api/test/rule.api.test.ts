// test/rule.api.test.ts
// Set up environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';

// Mock Prisma
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import ruleRoutes from '../src/routes/api/rule.route';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Rule, RuleSource } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

describe('Rule API Routes', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    app = Fastify();
    await app.register(sensible);
    await app.register(
      async (fastify) => {
        await fastify.register(errorHandler);
        await fastify.register(ruleRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create mock rule
  const createMockRule = (overrides: Partial<Rule> = {}): Rule => ({
    id: 1,
    message: 'Test rule',
    classtype: 'attempted-admin',
    sid: 1000000,
    rev: 1,
    ruleFormat: 'alert tcp $EXTERNAL_NET any -> $HOME_NET 22 (msg:"Test rule"; sid:1000000; rev:1;)',
    isActive: true,
    notes: 'Test notes',
    sourceId: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  // Helper to create mock rule source
  const createMockRuleSource = (overrides: Partial<RuleSource> = {}): RuleSource => ({
    id: 1,
    name: 'Emerging Threats',
    uri: 'https://rules.emergingthreats.net/rules.tar.gz',
    note: 'ET rules',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('POST /api/rule', () => {
    it('should fail with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rule',
        payload: {
          // missing ruleFormat
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with invalid rule format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rule',
        payload: {
          ruleFormat: 'invalid rule format',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/rule', () => {
    it('should list all rules', async () => {
      const mockRules = [
        createMockRule(),
        createMockRule({ id: 2, sid: 1000001, message: 'Rule 2' }),
      ];

      prismaMock.rule.findMany.mockResolvedValue(mockRules);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        id: 1,
        message: 'Test rule',
        sid: 1000000,
      });
    });

    it('should filter by active status', async () => {
      const mockRule = createMockRule({ isActive: true });
      prismaMock.rule.findMany.mockResolvedValue([mockRule]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule?isActive=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(body[0].isActive).toBe(true);
    });

    it('should filter by classtype', async () => {
      const mockRule = createMockRule({ classtype: 'attempted-admin' });
      prismaMock.rule.findMany.mockResolvedValue([mockRule]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule?classtype=attempted-admin',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(body[0].classtype).toBe('attempted-admin');
    });

    it('should support pagination', async () => {
      const mockRules = [createMockRule()];
      prismaMock.rule.findMany.mockResolvedValue(mockRules);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule?limit=10&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
    });
  });

  describe('GET /api/rule/:id', () => {
    it('should return 404 for non-existent rule', async () => {
      prismaMock.rule.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule/999',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('not found');
    });
  });

  describe('PUT /api/rule/:id', () => {
    it('should return 404 for non-existent rule', async () => {
      const { Prisma } = require('@prisma/client');
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });
      prismaMock.rule.update.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/rule/999',
        payload: {
          notes: 'Updated notes',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/rule/:id', () => {
    it('should delete rule', async () => {
      // First findUnique to check rule exists
      prismaMock.rule.findUnique.mockResolvedValueOnce(createMockRule());
      // Then delete returns deleted rule
      prismaMock.rule.delete.mockResolvedValueOnce(createMockRule());

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule/1',
      });

      expect(response.statusCode).toBe(204);
      expect(response.payload).toBe('');
    });

    it('should return 404 for non-existent rule', async () => {
      const { Prisma } = require('@prisma/client');
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });
      // Mock delete to throw not found error
      prismaMock.rule.delete.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule/999',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/rules.rules', () => {
    it('should export all active rules in Snort format', async () => {
      const mockRules = [
        createMockRule({
          ruleFormat: 'alert tcp any any -> any 22 (msg:"Rule 1"; sid:1000000; rev:1;)',
        }),
        createMockRule({
          id: 2,
          sid: 1000001,
          ruleFormat: 'alert tcp any any -> any 23 (msg:"Rule 2"; sid:1000001; rev:1;)',
        }),
      ];

      prismaMock.rule.findMany.mockResolvedValue(mockRules);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rules.rules',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload).toContain('alert tcp');
      expect(response.payload).toContain('Rule 1');
      expect(response.payload).toContain('Rule 2');
    });

    it('should only export active rules', async () => {
      const mockRules = [
        createMockRule({ isActive: true }),
      ];

      prismaMock.rule.findMany.mockResolvedValue(mockRules);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rules.rules',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;
      expect(body).toContain('Test rule');
    });
  });

  describe('POST /api/rulesource', () => {
    it('should create a new rule source', async () => {
      const mockSource = createMockRuleSource();

      prismaMock.ruleSource.findFirst.mockResolvedValue(null);
      prismaMock.ruleSource.create.mockResolvedValue(mockSource);

      const response = await app.inject({
        method: 'POST',
        url: '/api/rulesource',
        payload: {
          name: mockSource.name,
          uri: mockSource.uri,
          note: mockSource.note,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        id: mockSource.id,
        name: mockSource.name,
        uri: mockSource.uri,
      });
    });

    it('should fail with duplicate source name', async () => {
      const mockSource = createMockRuleSource();
      // Mock findUnique to return existing source (duplicate check)
      prismaMock.ruleSource.findUnique.mockResolvedValueOnce(mockSource);

      const response = await app.inject({
        method: 'POST',
        url: '/api/rulesource',
        payload: {
          name: mockSource.name,
          uri: mockSource.uri,
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should fail with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rulesource',
        payload: {
          name: 'Test',
          // missing uri
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/rulesource', () => {
    it('should list all rule sources', async () => {
      const mockSources = [
        createMockRuleSource(),
        createMockRuleSource({ id: 2, name: 'Snort Rules' }),
      ];

      prismaMock.ruleSource.findMany.mockResolvedValue(mockSources);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rulesource',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        id: 1,
        name: 'Emerging Threats',
      });
    });
  });

  describe('GET /api/rulesource/:id', () => {
    it('should get rule source by ID', async () => {
      const mockSource = createMockRuleSource();

      prismaMock.ruleSource.findUnique.mockResolvedValue(mockSource);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rulesource/1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        id: 1,
        name: 'Emerging Threats',
        uri: 'https://rules.emergingthreats.net/rules.tar.gz',
      });
    });

    it('should return 404 for non-existent source', async () => {
      prismaMock.ruleSource.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rulesource/999',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/rulesource/:id', () => {
    it('should update rule source', async () => {
      const mockSource = createMockRuleSource({ name: 'Updated Name' });

      // First findUnique to check source exists
      prismaMock.ruleSource.findUnique.mockResolvedValueOnce(mockSource);
      // Then update returns updated source
      prismaMock.ruleSource.update.mockResolvedValueOnce(mockSource);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/rulesource/1',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent source', async () => {
      const { Prisma } = require('@prisma/client');
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });
      // Mock update to throw not found error
      prismaMock.ruleSource.update.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/rulesource/999',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/rulesource/:id', () => {
    it('should delete rule source', async () => {
      // First findUnique to check source exists
      prismaMock.ruleSource.findUnique.mockResolvedValueOnce(createMockRuleSource());
      // Then delete returns deleted source
      prismaMock.ruleSource.delete.mockResolvedValueOnce(createMockRuleSource());

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rulesource/1',
      });

      expect(response.statusCode).toBe(204);
      expect(response.payload).toBe('');
    });

    it('should return 404 for non-existent source', async () => {
      const { Prisma } = require('@prisma/client');
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });
      // Mock delete to throw not found error
      prismaMock.ruleSource.delete.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rulesource/999',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
