// test/analytics.test.ts
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
import analyticsRoutes from '../src/routes/api/analytics.route';
import errorHandler from '../src/plugins/errorHandler';
import * as analyticsService from '../src/services/analytics.service';

describe('Analytics API Routes', () => {
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
        await fastify.register(analyticsRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/analytics/attacks/stats', () => {
    it('should return attack statistics', async () => {
      jest.spyOn(analyticsService, 'getAttackStats').mockResolvedValue({
        totalAttacks: 1000,
        uniqueAttackers: 50,
        uniqueTargets: 100,
        avgAttacksPerHour: 5,
        avgAttacksPerDay: 120,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/attacks/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.totalAttacks).toBe(1000);
      expect(body.uniqueAttackers).toBe(50);
    });

    it('should support date range filtering', async () => {
      jest.spyOn(analyticsService, 'getAttackStats').mockResolvedValue({
        totalAttacks: 500,
        uniqueAttackers: 25,
        uniqueTargets: 50,
        avgAttacksPerHour: 2.5,
        avgAttacksPerDay: 60,
      });

      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/attacks/stats?startTime=${startTime}&endTime=${endTime}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(analyticsService, 'getAttackStats')
        .mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/attacks/stats',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /api/analytics/attacks/timeseries', () => {
    it('should return time series data', async () => {
      const mockTimeSeries = [
        { timestamp: '2024-01-01', count: 100, period: 'daily' as const },
        { timestamp: '2024-01-02', count: 120, period: 'daily' as const },
      ];

      jest
        .spyOn(analyticsService, 'getAttackTimeSeries')
        .mockResolvedValue(mockTimeSeries);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/attacks/timeseries',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0].count).toBe(100);
    });

    it('should support different aggregation periods', async () => {
      jest
        .spyOn(analyticsService, 'getAttackTimeSeries')
        .mockResolvedValue([{ timestamp: '2024-01', count: 1000, period: 'monthly' as const }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/attacks/timeseries?period=monthly&limit=12',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body[0].period).toBe('monthly');
    });
  });

  describe('GET /api/analytics/protocols', () => {
    it('should return protocol distribution', async () => {
      const mockProtocols = [
        { protocol: 'TCP', count: 600, percentage: 60 },
        { protocol: 'UDP', count: 300, percentage: 30 },
        { protocol: 'HTTP', count: 100, percentage: 10 },
      ];

      jest
        .spyOn(analyticsService, 'getProtocolDistribution')
        .mockResolvedValue(mockProtocols);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/protocols',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(3);
      expect(body[0].protocol).toBe('TCP');
      expect(body[0].percentage).toBe(60);
    });
  });

  describe('GET /api/analytics/attackers/top', () => {
    it('should return top attackers', async () => {
      const mockAttackers = [
        {
          sourceIp: '192.168.1.1',
          attackCount: 500,
          uniqueTargets: 50,
          lastSeen: new Date(),
        },
        {
          sourceIp: '192.168.1.2',
          attackCount: 300,
          uniqueTargets: 30,
          lastSeen: new Date(),
        },
      ];

      jest
        .spyOn(analyticsService, 'getTopAttackers')
        .mockResolvedValue(mockAttackers);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/attackers/top?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0].sourceIp).toBe('192.168.1.1');
    });
  });

  describe('GET /api/analytics/geo/heatmap', () => {
    it('should return geographic heatmap', async () => {
      const mockHeatmap = [
        {
          country: 'China',
          attackCount: 1000,
          uniqueIps: 100,
          latitude: 35.8617,
          longitude: 104.1954,
        },
        {
          country: 'Russia',
          attackCount: 500,
          uniqueIps: 50,
          latitude: 61.524,
          longitude: 105.3188,
        },
      ];

      jest
        .spyOn(analyticsService, 'getGeoHeatmap')
        .mockResolvedValue(mockHeatmap);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/geo/heatmap',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0].country).toBe('China');
    });
  });

  describe('GET /api/analytics/sensors', () => {
    it('should return per-sensor statistics', async () => {
      const mockSensorStats = [
        {
          sensorId: 1,
          sensorName: 'Sensor 1',
          sensorUuid: 'uuid-1',
          totalAttacks: 100,
          uniqueAttackers: 20,
          primaryProtocol: 'TCP',
          lastAttackTime: new Date(),
        },
      ];

      jest
        .spyOn(analyticsService, 'getSensorStats')
        .mockResolvedValue(mockSensorStats);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/sensors',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body[0].sensorName).toBe('Sensor 1');
    });
  });

  describe('GET /api/analytics/countries', () => {
    it('should return country statistics', async () => {
      const mockCountries = [
        { country: 'China', count: 1000 },
        { country: 'Russia', count: 500 },
      ];

      jest
        .spyOn(analyticsService, 'getAttacksByCountry')
        .mockResolvedValue(mockCountries);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/countries?limit=50',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
    });
  });

  describe('GET /api/analytics/ports', () => {
    it('should return port statistics', async () => {
      const mockPorts = [
        { port: 22, count: 300 },
        { port: 80, count: 200 },
        { port: 443, count: 150 },
      ];

      jest
        .spyOn(analyticsService, 'getTopTargetPorts')
        .mockResolvedValue(mockPorts);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/ports?limit=20',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(3);
    });
  });

  describe('GET /api/analytics/frequency/hourly', () => {
    it('should return hourly frequency distribution', async () => {
      const mockFrequency = Array(24)
        .fill(0)
        .map((_, hour) => ({
          hour,
          count: Math.floor(Math.random() * 100),
        }));

      jest
        .spyOn(analyticsService, 'getHourlyFrequency')
        .mockResolvedValue(mockFrequency);

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/frequency/hourly',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(24);
    });
  });
});
