// test/dashboard.test.ts
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
import dashboardRoutes from '../src/routes/api/dashboard.route';
import errorHandler from '../src/plugins/errorHandler';
import * as dashboardService from '../src/services/dashboard.service';

describe('Dashboard API Routes', () => {
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
        await fastify.register(dashboardRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return dashboard summary', async () => {
      jest.spyOn(dashboardService, 'getDashboardSummary').mockResolvedValue({
        totalSensors: 10,
        activeSensors: 8,
        offlineSensors: 2,
        attacks24h: 1000,
        uniqueAttackers24h: 50,
        activeThreats: 5,
        topAttackingIp: '192.168.1.1',
        topAttackProtocol: 'TCP',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.totalSensors).toBe(10);
      expect(body.activeSensors).toBe(8);
      expect(body.activeThreats).toBe(5);
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(dashboardService, 'getDashboardSummary')
        .mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/summary',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /api/dashboard/sensors', () => {
    it('should return sensor statuses', async () => {
      const mockSensors = [
        {
          id: 1,
          uuid: 'uuid-1',
          name: 'Sensor 1',
          honeypot: 'dionaea',
          status: 'online' as const,
          lastHeartbeat: new Date(),
          activeAttacks24h: 100,
          totalAttacks: 1000,
          ipAddress: '192.168.1.1',
        },
      ];

      jest
        .spyOn(dashboardService, 'getSensorStatuses')
        .mockResolvedValue(mockSensors);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/sensors',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe('online');
    });
  });

  describe('GET /api/dashboard/threats', () => {
    it('should return active threats', async () => {
      const mockThreats = [
        {
          id: 'threat-1',
          sourceIp: '192.168.1.1',
          targetPort: 22,
          protocol: 'TCP',
          timestamp: new Date(),
          sensorUuid: 'uuid-1',
          sensorName: 'Sensor 1',
          severity: 'high' as const,
          description: 'SSH attack from 192.168.1.1',
        },
      ];

      jest
        .spyOn(dashboardService, 'getActiveThreats')
        .mockResolvedValue(mockThreats);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/threats?hours=1&limit=100',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(body[0].severity).toBe('high');
    });
  });

  describe('GET /api/dashboard/sensor/:id/health', () => {
    it('should return sensor health metrics', async () => {
      jest.spyOn(dashboardService, 'getSensorHealth').mockResolvedValue({
        sensorId: 1,
        uptime: 99.5,
        avgResponseTime: 50,
        lastHeartbeat: new Date(),
        isHealthy: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/sensor/1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.sensorId).toBe(1);
      expect(body.isHealthy).toBe(true);
    });

    it('should return 400 for invalid sensor ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/sensor/invalid/health',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle sensor not found', async () => {
      jest
        .spyOn(dashboardService, 'getSensorHealth')
        .mockRejectedValue(new Error('Sensor 999 not found'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/sensor/999/health',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /api/dashboard/trends', () => {
    it('should return attack trends', async () => {
      const mockTrends = [
        { timestamp: '2024-01-01 00:00:00', count: 50 },
        { timestamp: '2024-01-01 01:00:00', count: 75 },
      ];

      jest
        .spyOn(dashboardService, 'getAttackTrends')
        .mockResolvedValue(mockTrends);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/trends?hours=24',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
    });
  });

  describe('GET /api/dashboard/alerts', () => {
    it('should return current alerts', async () => {
      const mockAlerts = [
        {
          type: 'DDoS_PATTERN',
          severity: 'critical',
          message: 'Potential DDoS from 192.168.1.1',
          timestamp: new Date(),
          sourceIp: '192.168.1.1',
        },
      ];

      jest
        .spyOn(dashboardService, 'getAlerts')
        .mockResolvedValue(mockAlerts);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/alerts',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(body[0].severity).toBe('critical');
    });
  });

  describe('GET /api/dashboard/risk', () => {
    it('should return current risk level', async () => {
      jest
        .spyOn(dashboardService, 'getRiskLevel')
        .mockResolvedValue('high');

      const response = await app.inject({
        method: 'GET',
        url: '/api/dashboard/risk',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.level).toBe('high');
    });

    it('should return different risk levels', async () => {
      const riskLevels: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      for (const level of riskLevels) {
        jest
          .spyOn(dashboardService, 'getRiskLevel')
          .mockResolvedValueOnce(level);

        const response = await app.inject({
          method: 'GET',
          url: '/api/dashboard/risk',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.level).toBe(level);
      }
    });
  });
});
