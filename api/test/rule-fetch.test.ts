// test/rule-fetch.test.ts
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
import ruleFetchRoutes from '../src/routes/api/rule-fetch.route';
import errorHandler from '../src/plugins/errorHandler';
import { RuleFetchJob } from '@prisma/client';
import * as ruleFetchJobService from '../src/services/rule-fetcher-job.service';

describe('Rule Fetch API Routes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    app = Fastify();
    await app.register(sensible);
    await app.register(
      async (fastify) => {
        await fastify.register(errorHandler);
        await fastify.register(ruleFetchRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const createMockFetchJob = (overrides: Partial<RuleFetchJob> = {}): RuleFetchJob => ({
    id: 1,
    sourceId: 1,
    status: 'pending',
    rulesImported: 0,
    rulesFailed: 0,
    rulesSkipped: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    lastAttempt: new Date('2024-01-01T00:00:00Z'),
    attemptCount: 0,
    nextRetryAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('POST /api/rule-fetch/:sourceId', () => {
    it('should trigger a fetch job and return result', async () => {

      jest.spyOn(ruleFetchJobService, 'createFetchJob').mockResolvedValue(1);
      jest.spyOn(ruleFetchJobService, 'executeFetchJob').mockResolvedValue({
        jobId: 1,
        sourceId: 1,
        status: 'success',
        rulesImported: 100,
        rulesFailed: 0,
        rulesSkipped: 50,
        totalRules: 150,
        startedAt: new Date(),
        completedAt: new Date(),
        downloadedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe(1);
      expect(body.status).toBe('success');
      expect(body.rulesImported).toBe(100);
    });

    it('should fail with invalid source ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rule-fetch/invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Invalid');
    });

    it('should handle fetch job execution errors', async () => {
      jest.spyOn(ruleFetchJobService, 'createFetchJob').mockResolvedValue(1);
      jest
        .spyOn(ruleFetchJobService, 'executeFetchJob')
        .mockRejectedValue(new Error('Download failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(500);
    });

    it('should handle partial success', async () => {
      jest.spyOn(ruleFetchJobService, 'createFetchJob').mockResolvedValue(1);
      jest.spyOn(ruleFetchJobService, 'executeFetchJob').mockResolvedValue({
        jobId: 1,
        sourceId: 1,
        status: 'partial_success',
        rulesImported: 100,
        rulesFailed: 5,
        rulesSkipped: 50,
        totalRules: 155,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('partial_success');
      expect(body.rulesFailed).toBe(5);
    });
  });

  describe('GET /api/rule-fetch/:sourceId', () => {
    it('should list fetch jobs for a source', async () => {
      const mockJobs = [
        createMockFetchJob({ id: 1, status: 'success' }),
        createMockFetchJob({ id: 2, status: 'failed' }),
      ];

      jest
        .spyOn(ruleFetchJobService, 'listFetchJobs')
        .mockResolvedValue({ jobs: mockJobs, total: 2 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.jobs).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.jobs[0].id).toBe(1);
      expect(body.jobs[0].status).toBe('success');
    });

    it('should support pagination', async () => {
      const mockJobs = [createMockFetchJob()];

      jest
        .spyOn(ruleFetchJobService, 'listFetchJobs')
        .mockResolvedValue({ jobs: mockJobs, total: 100 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1?limit=10&offset=20',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(20);
      expect(body.total).toBe(100);
    });

    it('should fail with invalid source ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle database errors gracefully', async () => {
      jest
        .spyOn(ruleFetchJobService, 'listFetchJobs')
        .mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(500);
    });

    it('should return empty list if no jobs exist', async () => {
      jest.spyOn(ruleFetchJobService, 'listFetchJobs').mockResolvedValue({
        jobs: [],
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.jobs).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /api/rule-fetch/:sourceId/:jobId', () => {
    it('should return fetch job details', async () => {
      const mockJob = createMockFetchJob({
        id: 1,
        status: 'success',
        rulesImported: 100,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      jest.spyOn(ruleFetchJobService, 'getFetchJob').mockResolvedValue({
        ...mockJob,
        source: {
          id: 1,
          name: 'Emerging Threats',
          uri: 'https://rules.emergingthreats.net/rules.tar.gz',
          note: 'ET rules',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1/1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe(1);
      expect(body.status).toBe('success');
      expect(body.rulesImported).toBe(100);
    });

    it('should return 404 for non-existent job', async () => {
      jest
        .spyOn(ruleFetchJobService, 'getFetchJob')
        .mockRejectedValue(new Error('Fetch job not found: 999'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1/999',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('not found');
    });

    it('should fail with invalid job ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch/1/invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/rule-fetch/:jobId', () => {
    it('should cancel a pending job', async () => {
      jest.spyOn(ruleFetchJobService, 'cancelFetchJob').mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(204);
      expect(response.payload).toBe('');
    });

    it('should return 404 for non-existent job', async () => {
      jest
        .spyOn(ruleFetchJobService, 'cancelFetchJob')
        .mockRejectedValue(new Error('Fetch job not found: 999'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule-fetch/999',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail if job is already completed', async () => {
      jest
        .spyOn(ruleFetchJobService, 'cancelFetchJob')
        .mockRejectedValue(new Error('Cannot cancel completed job: 1'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule-fetch/1',
      });

      expect(response.statusCode).toBe(409);
    });

    it('should fail with invalid job ID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/rule-fetch/invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/rule-fetch-stats', () => {
    it('should return overall statistics', async () => {
      jest.spyOn(ruleFetchJobService, 'getFetchJobStats').mockResolvedValue({
        totalJobs: 100,
        successfulJobs: 85,
        failedJobs: 10,
        partialSuccessJobs: 5,
        pendingJobs: 0,
        inProgressJobs: 0,
        totalRulesImported: 10000,
        totalRulesFailed: 50,
        successRate: 90,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch-stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.totalJobs).toBe(100);
      expect(body.successfulJobs).toBe(85);
      expect(body.successRate).toBe(90);
      expect(body.totalRulesImported).toBe(10000);
    });

    it('should filter stats by source ID', async () => {
      jest.spyOn(ruleFetchJobService, 'getFetchJobStats').mockResolvedValue({
        totalJobs: 25,
        successfulJobs: 20,
        failedJobs: 3,
        partialSuccessJobs: 2,
        pendingJobs: 0,
        inProgressJobs: 0,
        totalRulesImported: 2500,
        totalRulesFailed: 10,
        successRate: 88,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch-stats?sourceId=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.totalJobs).toBe(25);
    });

    it('should fail with invalid source ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch-stats?sourceId=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(ruleFetchJobService, 'getFetchJobStats')
        .mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch-stats',
      });

      expect(response.statusCode).toBe(500);
    });

    it('should show zero success rate when no jobs exist', async () => {
      jest.spyOn(ruleFetchJobService, 'getFetchJobStats').mockResolvedValue({
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        partialSuccessJobs: 0,
        pendingJobs: 0,
        inProgressJobs: 0,
        totalRulesImported: 0,
        totalRulesFailed: 0,
        successRate: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/rule-fetch-stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.successRate).toBe(0);
    });
  });
});
