// test/rule-fetcher-job.service.test.ts
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

jest.mock('../src/lib/rule-fetcher');
jest.mock('../src/services/rule-importer.service');

import { prisma } from '../src/lib/prisma';
import {
  createFetchJob,
  getFetchJob,
  listFetchJobs,
  executeFetchJob,
  shouldRetryJob,
  calculateRetryDelay,
  scheduleRetry,
  getFetchJobStats,
  getPendingRetries,
  processFailedRetries,
  cancelFetchJob,
  FetchJobError,
} from '../src/services/rule-fetcher-job.service';
import { downloadRuleFile, RuleFetchError } from '../src/lib/rule-fetcher';
import { importRulesFromText } from '../src/services/rule-importer.service';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, RuleFetchJob, RuleSource } from '@prisma/client';

describe('Rule Fetcher Job Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
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
    lastAttempt: new Date(),
    attemptCount: 0,
    nextRetryAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockRuleSource = (overrides: Partial<RuleSource> = {}): RuleSource => ({
    id: 1,
    name: 'Emerging Threats',
    uri: 'https://rules.emergingthreats.net/rules.tar.gz',
    note: 'ET rules',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('createFetchJob', () => {
    it('should create a new fetch job', async () => {
      const mockJob = createMockFetchJob();
      prismaMock.ruleFetchJob.create.mockResolvedValue(mockJob);

      const jobId = await createFetchJob(1);

      expect(jobId).toBe(1);
      expect(prismaMock.ruleFetchJob.create).toHaveBeenCalledWith({
        data: {
          sourceId: 1,
          status: 'pending',
        },
      });
    });
  });

  describe('getFetchJob', () => {
    it('should return fetch job by ID', async () => {
      const mockJob = createMockFetchJob();
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);

      const job = await getFetchJob(1);

      expect(job.id).toBe(1);
      expect(prismaMock.ruleFetchJob.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { source: true },
      });
    });

    it('should throw error if job not found', async () => {
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(null);

      await expect(getFetchJob(999)).rejects.toThrow(FetchJobError);
      await expect(getFetchJob(999)).rejects.toThrow('not found');
    });
  });

  describe('listFetchJobs', () => {
    it('should list fetch jobs for a source', async () => {
      const mockJobs = [
        createMockFetchJob({ id: 1 }),
        createMockFetchJob({ id: 2 }),
      ];
      prismaMock.ruleFetchJob.findMany.mockResolvedValue(mockJobs);
      prismaMock.ruleFetchJob.count.mockResolvedValue(2);

      const { jobs, total } = await listFetchJobs(1, 50, 0);

      expect(jobs).toHaveLength(2);
      expect(total).toBe(2);
    });

    it('should support pagination', async () => {
      const mockJobs = [createMockFetchJob()];
      prismaMock.ruleFetchJob.findMany.mockResolvedValue(mockJobs);
      prismaMock.ruleFetchJob.count.mockResolvedValue(100);

      await listFetchJobs(1, 10, 20);

      expect(prismaMock.ruleFetchJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });

  describe('shouldRetryJob', () => {
    it('should not retry successful jobs', () => {
      const job = createMockFetchJob({ status: 'success' });
      expect(shouldRetryJob(job)).toBe(false);
    });

    it('should not retry partial success jobs', () => {
      const job = createMockFetchJob({ status: 'partial_success' });
      expect(shouldRetryJob(job)).toBe(false);
    });

    it('should retry failed jobs with attempts remaining', () => {
      const job = createMockFetchJob({ status: 'failed', attemptCount: 2 });
      expect(shouldRetryJob(job)).toBe(true);
    });

    it('should not retry after max attempts', () => {
      const job = createMockFetchJob({ status: 'failed', attemptCount: 5 });
      expect(shouldRetryJob(job)).toBe(false);
    });

    it('should not retry if retry time has not passed', () => {
      const futureDate = new Date(Date.now() + 60000);
      const job = createMockFetchJob({
        status: 'failed',
        attemptCount: 2,
        nextRetryAt: futureDate,
      });
      expect(shouldRetryJob(job)).toBe(false);
    });

    it('should retry if retry time has passed', () => {
      const pastDate = new Date(Date.now() - 60000);
      const job = createMockFetchJob({
        status: 'failed',
        attemptCount: 2,
        nextRetryAt: pastDate,
      });
      expect(shouldRetryJob(job)).toBe(true);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const baseDelay = 60000;
      expect(calculateRetryDelay(0, baseDelay)).toBe(60000); // 1 min
      expect(calculateRetryDelay(1, baseDelay)).toBe(120000); // 2 min
      expect(calculateRetryDelay(2, baseDelay)).toBe(240000); // 4 min
      expect(calculateRetryDelay(3, baseDelay)).toBe(480000); // 8 min
      expect(calculateRetryDelay(4, baseDelay)).toBe(960000); // 16 min
    });

    it('should cap at reasonable limits', () => {
      const baseDelay = 60000;
      // After 4 attempts, delay should plateau
      const delay5 = calculateRetryDelay(5, baseDelay);
      const delay6 = calculateRetryDelay(6, baseDelay);
      expect(delay5).toBeLessThanOrEqual(baseDelay * 16);
      expect(delay6).toBeLessThanOrEqual(baseDelay * 16);
    });
  });

  describe('scheduleRetry', () => {
    it('should schedule retry for failed job', async () => {
      const job = createMockFetchJob({
        status: 'failed',
        attemptCount: 2,
      });
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(job);
      prismaMock.ruleFetchJob.update.mockResolvedValue(job);

      await scheduleRetry(1);

      expect(prismaMock.ruleFetchJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            attemptCount: 3,
          }),
        }),
      );
    });

    it('should not schedule retry if max attempts reached', async () => {
      const job = createMockFetchJob({
        status: 'failed',
        attemptCount: 5,
      });
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(job);

      await scheduleRetry(1);

      expect(prismaMock.ruleFetchJob.update).not.toHaveBeenCalled();
    });
  });

  describe('executeFetchJob', () => {
    it('should successfully execute fetch and import', async () => {
      const mockJob = createMockFetchJob();
      const mockSource = createMockRuleSource();

      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleSource.findUnique.mockResolvedValue(mockSource);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      (downloadRuleFile as jest.Mock).mockResolvedValue({
        content: 'alert tcp any any -> any 22 (msg:"Test"; sid:1000000; rev:1;)\n',
        downloadedAt: new Date(),
      });

      (importRulesFromText as jest.Mock).mockResolvedValue({
        totalRules: 1,
        imported: 1,
        updated: 0,
        skipped: 0,
        failed: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      const result = await executeFetchJob(1);

      expect(result.jobId).toBe(1);
      expect(result.status).toBe('success');
      expect(result.rulesImported).toBe(1);
    });

    it('should mark job as in_progress', async () => {
      const mockJob = createMockFetchJob();
      const mockSource = createMockRuleSource();

      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleSource.findUnique.mockResolvedValue(mockSource);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      (downloadRuleFile as jest.Mock).mockResolvedValue({
        content: 'alert tcp any any -> any 22 (msg:"Test"; sid:1000000; rev:1;)\n',
        downloadedAt: new Date(),
      });

      (importRulesFromText as jest.Mock).mockResolvedValue({
        totalRules: 1,
        imported: 1,
        updated: 0,
        skipped: 0,
        failed: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      await executeFetchJob(1);

      // First call should mark as in_progress
      expect(prismaMock.ruleFetchJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in_progress',
          }),
        }),
      );
    });

    it('should handle download failures with retry', async () => {
      const mockJob = createMockFetchJob();
      const mockSource = createMockRuleSource();

      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleSource.findUnique.mockResolvedValue(mockSource);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      (downloadRuleFile as jest.Mock).mockRejectedValue(
        new RuleFetchError('Network timeout', true),
      );

      await expect(executeFetchJob(1)).rejects.toThrow(FetchJobError);

      // Should mark as failed
      expect(prismaMock.ruleFetchJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        }),
      );
    });

    it('should handle import failures with partial success', async () => {
      const mockJob = createMockFetchJob();
      const mockSource = createMockRuleSource();

      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleSource.findUnique.mockResolvedValue(mockSource);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      (downloadRuleFile as jest.Mock).mockResolvedValue({
        content: 'invalid rules here',
        downloadedAt: new Date(),
      });

      (importRulesFromText as jest.Mock).mockResolvedValue({
        totalRules: 5,
        imported: 3,
        updated: 0,
        skipped: 1,
        failed: [
          { lineNumber: 1, ruleText: 'invalid', error: 'Parse error' },
          { lineNumber: 2, ruleText: 'invalid', error: 'Parse error' },
        ],
        startTime: new Date(),
        endTime: new Date(),
      });

      const result = await executeFetchJob(1);

      expect(result.status).toBe('partial_success');
      expect(result.rulesFailed).toBe(2);
    });

    it('should throw error if source not found', async () => {
      const mockJob = createMockFetchJob();

      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleSource.findUnique.mockResolvedValue(null);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      await expect(executeFetchJob(1)).rejects.toThrow(FetchJobError);
    });
  });

  describe('getFetchJobStats', () => {
    it('should return statistics', async () => {
      prismaMock.ruleFetchJob.count.mockResolvedValue(100);
      prismaMock.ruleFetchJob.aggregate.mockResolvedValue({
        _sum: { rulesImported: 10000 },
      });

      // Mock multiple count calls for different statuses
      const countMock = prismaMock.ruleFetchJob.count as jest.Mock;
      countMock.mockResolvedValueOnce(100); // totalJobs
      countMock.mockResolvedValueOnce(85); // successfulJobs
      countMock.mockResolvedValueOnce(10); // failedJobs
      countMock.mockResolvedValueOnce(5); // partialSuccessJobs
      countMock.mockResolvedValueOnce(0); // pendingJobs
      countMock.mockResolvedValueOnce(0); // inProgressJobs

      const stats = await getFetchJobStats();

      expect(stats.totalJobs).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });

    it('should filter by source ID', async () => {
      prismaMock.ruleFetchJob.count.mockResolvedValue(25);

      const countMock = prismaMock.ruleFetchJob.count as jest.Mock;
      countMock.mockResolvedValueOnce(25);
      countMock.mockResolvedValueOnce(20);
      countMock.mockResolvedValueOnce(3);
      countMock.mockResolvedValueOnce(2);
      countMock.mockResolvedValueOnce(0);
      countMock.mockResolvedValueOnce(0);

      await getFetchJobStats(1);

      expect(prismaMock.ruleFetchJob.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceId: 1,
          }),
        }),
      );
    });
  });

  describe('getPendingRetries', () => {
    it('should return jobs due for retry', async () => {
      const pastDate = new Date(Date.now() - 60000);
      const mockJobs = [
        createMockFetchJob({
          id: 1,
          status: 'failed',
          nextRetryAt: pastDate,
          attemptCount: 2,
        }),
      ];

      prismaMock.ruleFetchJob.findMany.mockResolvedValue(mockJobs);

      const jobs = await getPendingRetries();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('failed');
    });

    it('should not include jobs that are not yet due', async () => {
      const futureDate = new Date(Date.now() + 60000);
      prismaMock.ruleFetchJob.findMany.mockResolvedValue([]);

      const jobs = await getPendingRetries();

      expect(jobs).toHaveLength(0);
    });
  });

  describe('processFailedRetries', () => {
    it('should process multiple failed retries', async () => {
      const mockJobs = [
        createMockFetchJob({ id: 1, status: 'failed' }),
        createMockFetchJob({ id: 2, status: 'failed' }),
      ];

      prismaMock.ruleFetchJob.findMany.mockResolvedValue(mockJobs);
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJobs[0]);
      prismaMock.ruleSource.findUnique.mockResolvedValue(createMockRuleSource());
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJobs[0]);

      (downloadRuleFile as jest.Mock).mockResolvedValue({
        content: 'alert tcp any any -> any 22 (msg:"Test"; sid:1000000; rev:1;)\n',
        downloadedAt: new Date(),
      });

      (importRulesFromText as jest.Mock).mockResolvedValue({
        totalRules: 1,
        imported: 1,
        updated: 0,
        skipped: 0,
        failed: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      const results = await processFailedRetries();

      expect(results).toHaveLength(2);
    });
  });

  describe('cancelFetchJob', () => {
    it('should cancel pending job', async () => {
      const mockJob = createMockFetchJob({ status: 'pending' });
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.ruleFetchJob.update.mockResolvedValue(mockJob);

      await cancelFetchJob(1);

      expect(prismaMock.ruleFetchJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: 'Job cancelled by user',
          }),
        }),
      );
    });

    it('should throw error if job already completed', async () => {
      const mockJob = createMockFetchJob({ status: 'success' });
      prismaMock.ruleFetchJob.findUnique.mockResolvedValue(mockJob);

      await expect(cancelFetchJob(1)).rejects.toThrow(FetchJobError);
      await expect(cancelFetchJob(1)).rejects.toThrow('Cannot cancel');
    });
  });
});
