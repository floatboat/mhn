// test/sensor.test.ts
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
jest.mock('uuid', () => ({
  v1: jest.fn(() => '12345678-1234-1234-1234-123456789012'),
}));

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import sensorRoutes from '../src/routes/api/sensor.route';
import errorHandler from '../src/plugins/errorHandler';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Sensor } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

describe('Sensor API Routes', () => {
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
        await fastify.register(sensorRoutes);
      },
      { prefix: '/api' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create mock sensor
  const createMockSensor = (overrides: Partial<Sensor> = {}): Sensor => ({
    id: 1,
    uuid: '12345678-1234-1234-1234-123456789012',
    name: 'test-sensor',
    hostname: 'honeypot.local',
    ip: '192.168.1.100',
    identifier: '12345678-1234-1234-1234-123456789012',
    honeypot: 'cowrie',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('POST /api/sensor (registerSensor)', () => {
    const validSensor = {
      name: 'test-sensor',
      hostname: 'honeypot.local',
      honeypot: 'cowrie',
    };

    it('should create a new sensor successfully', async () => {
      const mockSensor = createMockSensor();
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.create.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sensor?deploy_key=test-deploy-key',
        payload: validSensor,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody).toMatchObject({
        id: 1,
        uuid: expect.any(String),
        name: validSensor.name,
        hostname: validSensor.hostname,
        honeypot: validSensor.honeypot,
        ip: expect.any(String),
        identifier: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 409 for duplicate sensor name', async () => {
      const existingSensor = createMockSensor();
      prismaMock.sensor.findFirst.mockResolvedValue(existingSensor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sensor?deploy_key=test-deploy-key',
        payload: validSensor,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: expect.stringContaining('already exists'),
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sensor?deploy_key=test-deploy-key',
        payload: {
          name: 'test-sensor',
          // Missing hostname and honeypot
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid honeypot type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sensor?deploy_key=test-deploy-key',
        payload: {
          name: 'test-sensor',
          hostname: 'honeypot.local',
          honeypot: 'invalid-type',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should verify uuid and identifier are identical', async () => {
      const mockSensor = createMockSensor();
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.create.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sensor?deploy_key=test-deploy-key',
        payload: validSensor,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.uuid).toBe(responseBody.identifier);
    });
  });

  describe('GET /api/sensor (getSensors)', () => {
    it('should return empty list when no sensors', async () => {
      prismaMock.sensor.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sensor',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it('should return all sensors when no filters', async () => {
      const mockSensors = [
        createMockSensor({ id: 1, name: 'sensor1' }),
        createMockSensor({ id: 2, name: 'sensor2', honeypot: 'dionaea' }),
      ];
      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sensor',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toHaveLength(2);
      expect(responseBody[0]).toMatchObject({
        id: 1,
        name: 'sensor1',
      });
    });

    it('should filter by honeypot type', async () => {
      const mockSensors = [createMockSensor({ honeypot: 'cowrie' })];
      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sensor?honeypot=cowrie',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toHaveLength(1);
      expect(responseBody[0].honeypot).toBe('cowrie');
    });

    it('should filter by date range', async () => {
      const mockSensors = [
        createMockSensor({
          createdAt: new Date('2024-06-15T00:00:00Z'),
        }),
      ];
      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sensor?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toHaveLength(1);
    });
  });

  describe('GET /api/sensor/:uuid (getSensor)', () => {
    const testUuid = '12345678-1234-1234-1234-123456789012';

    it('should return sensor details', async () => {
      const mockSensor = createMockSensor({ uuid: testUuid });
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toMatchObject({
        uuid: testUuid,
        name: 'test-sensor',
        hostname: 'honeypot.local',
      });
    });

    it('should return 404 for non-existent sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Not Found',
        message: 'Sensor not found',
      });
    });

    it('should return 400 for invalid uuid format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sensor/invalid-uuid?api_key=test-key',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/sensor/:uuid (updateSensor)', () => {
    const testUuid = '12345678-1234-1234-1234-123456789012';

    it('should update name and hostname', async () => {
      const existingSensor = createMockSensor({ uuid: testUuid });
      const updatedSensor = createMockSensor({
        uuid: testUuid,
        name: 'updated-sensor',
        hostname: 'new-honeypot.local',
      });

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
        payload: {
          name: 'updated-sensor',
          hostname: 'new-honeypot.local',
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toMatchObject({
        uuid: testUuid,
        name: 'updated-sensor',
        hostname: 'new-honeypot.local',
      });
    });

    it('should return 404 for non-existent sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
        payload: {
          name: 'updated-sensor',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 for duplicate name', async () => {
      const existingSensor = createMockSensor({ uuid: testUuid });
      const conflictingSensor = createMockSensor({
        id: 2,
        uuid: 'different-uuid',
        name: 'existing-name',
      });

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.findFirst.mockResolvedValue(conflictingSensor);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
        payload: {
          name: 'existing-name',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should allow updating only name', async () => {
      const existingSensor = createMockSensor({ uuid: testUuid });
      const updatedSensor = createMockSensor({
        uuid: testUuid,
        name: 'new-name',
      });

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
        payload: {
          name: 'new-name',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().name).toBe('new-name');
    });

    it('should allow updating only hostname', async () => {
      const existingSensor = createMockSensor({ uuid: testUuid });
      const updatedSensor = createMockSensor({
        uuid: testUuid,
        hostname: 'new-hostname',
      });

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
        payload: {
          hostname: 'new-hostname',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().hostname).toBe('new-hostname');
    });
  });

  describe('DELETE /api/sensor/:uuid (deleteSensor)', () => {
    const testUuid = '12345678-1234-1234-1234-123456789012';

    it('should delete sensor successfully', async () => {
      const mockSensor = createMockSensor({ uuid: testUuid });
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.sensor.delete.mockResolvedValue(mockSensor);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Sensor deleted successfully',
      });
    });

    it('should return 404 for non-existent sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should verify sensor is deleted', async () => {
      const mockSensor = createMockSensor({ uuid: testUuid });
      prismaMock.sensor.findUnique
        .mockResolvedValueOnce(mockSensor) // DELETE request
        .mockResolvedValueOnce(null); // Subsequent GET should return null
      prismaMock.sensor.delete.mockResolvedValue(mockSensor);

      // Delete the sensor
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });
      expect(deleteResponse.statusCode).toBe(200);

      // Try to get the deleted sensor
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/sensor/${testUuid}?api_key=test-key`,
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('POST /api/sensor/:uuid/connect (sensorConnect)', () => {
    const testUuid = '12345678-1234-1234-1234-123456789012';

    it('should record sensor check-in successfully', async () => {
      const mockSensor = createMockSensor({ uuid: testUuid });
      const updatedSensor = createMockSensor({
        uuid: testUuid,
        ip: '192.168.1.200',
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      });

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'POST',
        url: `/api/sensor/${testUuid}/connect?deploy_key=test-deploy-key`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody).toMatchObject({
        message: 'Sensor check-in successful',
        ip: expect.any(String),
      });
    });

    it('should return 404 for non-existent sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: `/api/sensor/${testUuid}/connect?deploy_key=test-deploy-key`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should update IP address on check-in', async () => {
      const oldIp = '192.168.1.100';
      const newIp = '192.168.1.200';
      const mockSensor = createMockSensor({ uuid: testUuid, ip: oldIp });
      const updatedSensor = createMockSensor({ uuid: testUuid, ip: newIp });

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'POST',
        url: `/api/sensor/${testUuid}/connect?deploy_key=test-deploy-key`,
        headers: {
          'x-forwarded-for': newIp,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: testUuid },
          data: expect.objectContaining({
            ip: expect.any(String),
          }),
        }),
      );
    });

    it('should capture client IP correctly', async () => {
      const clientIp = '203.0.113.45';
      const mockSensor = createMockSensor({ uuid: testUuid });
      const updatedSensor = createMockSensor({ uuid: testUuid, ip: clientIp });

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const response = await app.inject({
        method: 'POST',
        url: `/api/sensor/${testUuid}/connect?deploy_key=test-deploy-key`,
        headers: {
          'x-forwarded-for': clientIp,
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody.ip).toBe(clientIp);
    });
  });
});
