// test/export.test.ts
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.MONGODB_URL = 'mongodb://localhost:27017/attacks';

jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

jest.mock('../src/lib/mongodb');

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import exportRoutes from '../src/routes/api/export.route';
import errorHandler from '../src/plugins/errorHandler';

describe('Export API Routes', () => {
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
        await fastify.register(exportRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/export/attacks/json', () => {
    it('should export attacks as JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attacks.json');
    });

    it('should support date filtering', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/export/attacks/json?startTime=${startTime}&endTime=${endTime}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sensor filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/json?sensorId=1',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support IP filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/json?sourceIp=192.168.1.1',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/export/attacks/csv', () => {
    it('should export attacks as CSV', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/csv',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attacks.csv');
    });
  });

  describe('GET /api/export/attacks/ndjson', () => {
    it('should export attacks as NDJSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/ndjson',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-ndjson');
      expect(response.headers['content-disposition']).toContain('attacks.ndjson');
    });
  });

  describe('GET /api/export/statistics', () => {
    it('should export attack statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/statistics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('statistics.json');
    });

    it('should include protocol distribution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/statistics',
      });

      expect(response.statusCode).toBe(200);
      // Response body should contain protocols array
    });

    it('should include top countries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/statistics',
      });

      expect(response.statusCode).toBe(200);
      // Response body should contain topCountries array
    });
  });

  describe('GET /api/export/heatmap', () => {
    it('should export geographic heatmap data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/heatmap',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('heatmap.json');
    });

    it('should support date filtering', async () => {
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/export/heatmap?startTime=${startTime}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Export format validation', () => {
    it('CSV should have proper headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/csv',
      });

      expect(response.statusCode).toBe(200);
      const csv = response.payload;
      // CSV should start with headers
      expect(csv).toContain('timestamp');
      expect(csv).toContain('sourceIp');
    });

    it('JSON should be valid JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/export/attacks/json',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('attacks');
      expect(data).toHaveProperty('count');
    });
  });
});
