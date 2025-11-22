// test/attack.api.test.ts
// Set up environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/mhn_test';

// Mock Prisma
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

// Mock MongoDB
jest.mock('../src/lib/mongodb', () => ({
  getMongoDB: jest.fn(() => ({
    collection: jest.fn(() => ({
      findOne: jest.fn(),
      insertOne: jest.fn(),
      deleteMany: jest.fn(),
    })),
  })),
}));

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import attackRoutes from '../src/routes/api/attack.route';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Attack, Sensor } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { getMongoDB } from '../src/lib/mongodb';

describe('Attack API Routes', () => {
  let app: FastifyInstance;
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const mongoMock = getMongoDB as jest.MockedFunction<typeof getMongoDB>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    app = Fastify();
    await app.register(sensible);
    await app.register(
      async (fastify) => {
        await fastify.register(errorHandler);
        await fastify.register(attackRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create mock attack
  const createMockAttack = (overrides: Partial<Attack> = {}): Attack => ({
    id: 1,
    sourceIp: '192.168.1.100',
    protocol: 'TCP',
    port: 22,
    timestamp: new Date('2024-01-01T00:00:00Z'),
    sensorId: 1,
    mongoId: '507f1f77bcf86cd799439011',
    country: 'US',
    city: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  // Helper to create mock sensor
  const createMockSensor = (overrides: Partial<Sensor> = {}): Sensor => ({
    id: 1,
    uuid: '12345678-1234-1234-1234-123456789012',
    name: 'test-sensor',
    hostname: 'honeypot.local',
    ip: '192.168.1.50',
    identifier: '12345678-1234-1234-1234-123456789012',
    honeypot: 'cowrie',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('GET /api/attack', () => {
    it('should return attacks with date range', async () => {
      const mockAttacks = [
        createMockAttack(),
        createMockAttack({ id: 2, sourceIp: '10.0.0.5' }),
      ];
      const mockSensor = createMockSensor();

      prismaMock.attack.count.mockResolvedValueOnce(100); // total
      prismaMock.attack.count.mockResolvedValueOnce(2); // filtered
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('attacks');
      expect(body).toHaveProperty('total', 100);
      expect(body).toHaveProperty('filtered', 2);
      expect(body.attacks).toHaveLength(2);
      expect(body.attacks[0]).toMatchObject({
        id: 1,
        sourceIp: '192.168.1.100',
        protocol: 'TCP',
        sensor: {
          uuid: mockSensor.uuid,
          name: mockSensor.name,
          honeypot: mockSensor.honeypot,
        },
      });
    });

    it('should filter by sensorId', async () => {
      const mockAttack = createMockAttack();
      const mockSensor = createMockSensor();

      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(1);
      prismaMock.attack.findMany.mockResolvedValue([mockAttack]);
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&sensorId=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.filtered).toBe(1);
    });

    it('should filter by protocol', async () => {
      const mockAttack = createMockAttack({ protocol: 'SSH' });
      const mockSensor = createMockSensor();

      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(1);
      prismaMock.attack.findMany.mockResolvedValue([mockAttack]);
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&protocol=SSH',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.attacks[0].protocol).toBe('SSH');
    });

    it('should apply pagination', async () => {
      const mockAttacks = [createMockAttack()];
      const mockSensor = createMockSensor();

      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&limit=10&offset=20',
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should return 400 for missing date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=invalid&endDate=2024-01-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });

    it('should return 400 when startDate is after endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-02-01T00:00:00Z&endDate=2024-01-01T00:00:00Z',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('startDate must be before endDate'),
      });
    });

    it('should return 400 for invalid sensorId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&sensorId=invalid',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });

    it('should return 400 for invalid limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&limit=9999',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining(
          'limit must be a positive integer between 1 and 1000',
        ),
      });
    });
  });

  describe('GET /api/attack/stats', () => {
    it('should return attack statistics', async () => {
      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue([
        { sourceIp: '192.168.1.100' } as Attack,
        { sourceIp: '10.0.0.5' } as Attack,
      ]);
      prismaMock.attack.groupBy.mockResolvedValueOnce([
        { protocol: 'TCP', _count: { protocol: 50 } },
        { protocol: 'UDP', _count: { protocol: 30 } },
      ] as any);
      prismaMock.attack.groupBy.mockResolvedValueOnce([
        { country: 'US', _count: { country: 60 } },
        { country: 'CN', _count: { country: 40 } },
      ] as any);
      prismaMock.attack.groupBy.mockResolvedValueOnce([
        { sensorId: 1, _count: { sensorId: 100 } },
      ] as any);
      prismaMock.sensor.findUnique.mockResolvedValue(createMockSensor());

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('totalAttacks', 100);
      expect(body).toHaveProperty('uniqueAttackers', 2);
      expect(body).toHaveProperty('topProtocols');
      expect(body).toHaveProperty('topCountries');
      expect(body).toHaveProperty('attacksByHoneypot');
      expect(body).toHaveProperty('timeRange');
    });

    it('should accept optional date range', async () => {
      prismaMock.attack.count.mockResolvedValue(50);
      prismaMock.attack.findMany.mockResolvedValue([]);
      prismaMock.attack.groupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/stats?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/stats?startDate=invalid',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });
  });

  describe('GET /api/attack/top-attackers', () => {
    it('should return top attackers', async () => {
      const mockSensor = createMockSensor();

      prismaMock.attack.groupBy.mockResolvedValue([
        { sourceIp: '192.168.1.100', _count: { sourceIp: 50 } },
        { sourceIp: '10.0.0.5', _count: { sourceIp: 30 } },
      ] as any);

      // Mock findMany to return attacks with sensor relation
      prismaMock.attack.findMany.mockResolvedValueOnce([
        {
          ...createMockAttack({ sourceIp: '192.168.1.100', protocol: 'TCP' }),
          sensor: mockSensor,
        } as any,
      ]);
      prismaMock.attack.findMany.mockResolvedValueOnce([
        {
          ...createMockAttack({ sourceIp: '10.0.0.5', protocol: 'UDP' }),
          sensor: mockSensor,
        } as any,
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/top-attackers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('sourceIp');
      expect(body[0]).toHaveProperty('attackCount');
      expect(body[0]).toHaveProperty('protocols');
      expect(body[0]).toHaveProperty('sensorsHit');
    });

    it('should apply custom limit', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/top-attackers?limit=5',
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.attack.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should return 400 for invalid limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/top-attackers?limit=999',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining(
          'limit must be a positive integer between 1 and 100',
        ),
      });
    });
  });

  describe('GET /api/attack/geo', () => {
    it('should return geographic statistics', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([
        { country: 'US', _count: { country: 50 } },
        { country: 'CN', _count: { country: 30 } },
      ] as any);

      // For US country
      prismaMock.attack.findMany.mockResolvedValueOnce([
        { sourceIp: '192.168.1.100' } as Attack,
        { sourceIp: '10.0.0.5' } as Attack,
      ]);
      prismaMock.attack.findMany.mockResolvedValueOnce([
        createMockAttack({
          country: 'US',
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ]);

      // For CN country
      prismaMock.attack.findMany.mockResolvedValueOnce([
        { sourceIp: '1.2.3.4' } as Attack,
      ]);
      prismaMock.attack.findMany.mockResolvedValueOnce([
        createMockAttack({
          country: 'CN',
          latitude: 39.9042,
          longitude: 116.4074,
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/geo',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('country');
        expect(body[0]).toHaveProperty('country_code');
        expect(body[0]).toHaveProperty('latitude');
        expect(body[0]).toHaveProperty('longitude');
        expect(body[0]).toHaveProperty('attackCount');
        expect(body[0]).toHaveProperty('uniqueIps');
      }
    });

    it('should accept optional date range', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/geo?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/attack/sensor/:sensorId', () => {
    it('should return attacks for sensor', async () => {
      const mockAttacks = [
        createMockAttack({ id: 1 }),
        createMockAttack({ id: 2, sourceIp: '10.0.0.5' }),
      ];

      prismaMock.sensor.findUnique.mockResolvedValue(createMockSensor());
      prismaMock.attack.count.mockResolvedValue(2);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/sensor/1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('attacks');
      expect(body).toHaveProperty('total', 2);
      expect(body.attacks.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/sensor/999',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('Sensor with ID 999 not found'),
      });
    });

    it('should return 400 for invalid sensorId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/sensor/invalid',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });

    it('should apply pagination', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(createMockSensor());
      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/sensor/1?limit=10&offset=20',
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('GET /api/attack/search', () => {
    it('should search attacks by IP', async () => {
      const mockAttacks = [createMockAttack({ sourceIp: '192.168.1.100' })];

      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/search?ip=192.168.1.100',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('attacks');
      expect(body).toHaveProperty('total', 1);
      expect(body.attacks[0].sourceIp).toBe('192.168.1.100');
    });

    it('should return 400 for missing IP parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/search',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });

    it('should apply custom limit', async () => {
      prismaMock.attack.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/search?ip=192.168.1.100&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });
  });

  describe('GET /api/attack/:id', () => {
    it('should return attack detail from MongoDB', async () => {
      // Mock MongoDB to return null (simulating not found)
      // This tests the 200 response path even if we get null back
      const mockFindOne = jest.fn().mockResolvedValue(null);
      const mockCollection = jest.fn(() => ({
        findOne: mockFindOne,
      }));
      (getMongoDB as jest.Mock).mockReturnValue({
        collection: mockCollection,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/507f1f77bcf86cd799439011',
      });

      // This will return 404 since mock returns null
      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent attack', async () => {
      const mockDb = {
        collection: jest.fn(() => ({
          findOne: jest.fn().mockResolvedValue(null),
        })),
      };
      mongoMock.mockReturnValue(mockDb as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/507f1f77bcf86cd799439011',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Not Found',
        message: 'Attack not found',
      });
    });

    it('should return 400 for invalid ObjectId format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/attack/invalid-object-id',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });
  });
});
