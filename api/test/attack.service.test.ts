// test/attack.service.test.ts
// Set up environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.DEPLOY_KEY = 'test-deploy-key';
process.env.MONGODB_URI = 'mongodb://test:test@localhost:27017/test';

// Mock Prisma
jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

// Mock MongoDB
jest.mock('../src/lib/mongodb', () => ({
  getMongoDB: jest.fn(),
  connectMongoDB: jest.fn(),
  disconnectMongoDB: jest.fn(),
}));

import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { getMongoDB } from '../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  recordAttackEvent,
  getAttacksByDateRange,
  getAttackStatistics,
  getTopAttackers,
  getAttacksBySensor,
  getAttackDetail,
  getGeoStatistics,
  searchAttacksByIp,
  getAttacksByHoneypot,
  validateSourceIp,
  validateProtocol,
  validatePort,
  validateCoordinates,
  AttackValidationError,
  AttackStorageError,
  SensorNotFoundError,
} from '../src/services/attack.service';

describe('Attack Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const getMongoDBMock = getMongoDB as jest.MockedFunction<typeof getMongoDB>;

  // Mock MongoDB collection
  const mockMongoCollection = {
    insertOne: jest.fn(),
    findOne: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createIndex: jest.fn(),
  };

  const mockMongoDB = {
    collection: jest.fn().mockReturnValue(mockMongoCollection),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getMongoDBMock.mockReturnValue(mockMongoDB as any);
  });

  // ===== VALIDATION TESTS =====
  describe('Validation Functions', () => {
    describe('validateSourceIp()', () => {
      it('should accept valid IPv4 addresses', () => {
        expect(validateSourceIp('192.168.1.1')).toBe(true);
        expect(validateSourceIp('10.0.0.1')).toBe(true);
        expect(validateSourceIp('172.16.0.1')).toBe(true);
        expect(validateSourceIp('255.255.255.255')).toBe(true);
        expect(validateSourceIp('0.0.0.0')).toBe(true);
      });

      it('should accept valid IPv6 addresses', () => {
        expect(
          validateSourceIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
        ).toBe(true);
        expect(validateSourceIp('::1')).toBe(true);
        // Note: '::' alone may not pass the simplified IPv6 regex
      });

      it('should reject invalid IP formats', () => {
        expect(validateSourceIp('256.1.1.1')).toBe(false); // Out of range
        expect(validateSourceIp('192.168.1')).toBe(false); // Incomplete
        expect(validateSourceIp('not-an-ip')).toBe(false); // Invalid
        expect(validateSourceIp('192.168.1.1.1')).toBe(false); // Too many octets
        expect(validateSourceIp('')).toBe(false); // Empty
      });
    });

    describe('validateProtocol()', () => {
      it('should accept valid protocols (case insensitive)', () => {
        expect(validateProtocol('TCP')).toBe(true);
        expect(validateProtocol('tcp')).toBe(true);
        expect(validateProtocol('UDP')).toBe(true);
        expect(validateProtocol('HTTP')).toBe(true);
        expect(validateProtocol('HTTPS')).toBe(true);
        expect(validateProtocol('SSH')).toBe(true);
        expect(validateProtocol('FTP')).toBe(true);
        expect(validateProtocol('SMTP')).toBe(true);
        expect(validateProtocol('DNS')).toBe(true);
        expect(validateProtocol('ICMP')).toBe(true);
        expect(validateProtocol('OTHER')).toBe(true);
      });

      it('should reject invalid protocols', () => {
        expect(validateProtocol('INVALID')).toBe(false);
        expect(validateProtocol('HTTP2')).toBe(false);
        expect(validateProtocol('')).toBe(false);
        expect(validateProtocol('tcp/ip')).toBe(false);
      });
    });

    describe('validatePort()', () => {
      it('should accept valid port numbers', () => {
        expect(validatePort(1)).toBe(true);
        expect(validatePort(80)).toBe(true);
        expect(validatePort(443)).toBe(true);
        expect(validatePort(8080)).toBe(true);
        expect(validatePort(65535)).toBe(true);
      });

      it('should reject invalid port numbers', () => {
        expect(validatePort(0)).toBe(false); // Too low
        expect(validatePort(-1)).toBe(false); // Negative
        expect(validatePort(65536)).toBe(false); // Too high
        expect(validatePort(100000)).toBe(false); // Way too high
        expect(validatePort(3.14)).toBe(false); // Not integer
      });
    });

    describe('validateCoordinates()', () => {
      it('should accept valid coordinates', () => {
        expect(validateCoordinates(0, 0)).toBe(true);
        expect(validateCoordinates(45.5, -122.6)).toBe(true); // Portland
        expect(validateCoordinates(90, 180)).toBe(true); // Extremes
        expect(validateCoordinates(-90, -180)).toBe(true); // Extremes
      });

      it('should reject invalid coordinates', () => {
        expect(validateCoordinates(91, 0)).toBe(false); // Lat too high
        expect(validateCoordinates(-91, 0)).toBe(false); // Lat too low
        expect(validateCoordinates(0, 181)).toBe(false); // Lng too high
        expect(validateCoordinates(0, -181)).toBe(false); // Lng too low
      });
    });
  });

  // ===== RECORD ATTACK EVENT TESTS =====
  describe('recordAttackEvent()', () => {
    const mockSensor = {
      id: 1,
      uuid: '550e8400-e29b-11d4-a716-446655440000',
      name: 'test-sensor',
      hostname: 'sensor.example.com',
      ip: '192.168.1.100',
      identifier: '550e8400-e29b-11d4-a716-446655440000',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const validAttackData = {
      sensorUuid: mockSensor.uuid,
      sourceIp: '10.0.0.1',
      protocol: 'TCP',
      mongoPayload: { test: 'data', connection: 'details' },
      port: 445,
      country: 'US',
      city: 'Portland',
      latitude: 45.5,
      longitude: -122.6,
    };

    it('should successfully record attack event in both MongoDB and PostgreSQL', async () => {
      const mockMongoId = new ObjectId();
      const mockAttack = {
        id: 1,
        sourceIp: validAttackData.sourceIp,
        protocol: 'TCP',
        port: validAttackData.port,
        timestamp: expect.any(Date),
        sensorId: mockSensor.id,
        mongoId: mockMongoId.toString(),
        country: validAttackData.country,
        city: validAttackData.city,
        latitude: validAttackData.latitude,
        longitude: validAttackData.longitude,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      mockMongoCollection.insertOne.mockResolvedValue({
        insertedId: mockMongoId,
        acknowledged: true,
      });
      prismaMock.attack.create.mockResolvedValue(mockAttack);

      const result = await recordAttackEvent(
        validAttackData.sensorUuid,
        validAttackData.sourceIp,
        validAttackData.protocol,
        validAttackData.mongoPayload,
        validAttackData.port,
        validAttackData.country,
        validAttackData.city,
        validAttackData.latitude,
        validAttackData.longitude,
      );

      expect(result).toEqual({
        attackId: mockAttack.id,
        mongoId: mockMongoId.toString(),
      });

      expect(prismaMock.sensor.findUnique).toHaveBeenCalledWith({
        where: { uuid: validAttackData.sensorUuid },
      });

      expect(mockMongoCollection.insertOne).toHaveBeenCalled();
      expect(prismaMock.attack.create).toHaveBeenCalled();
    });

    it('should throw AttackValidationError for invalid source IP', async () => {
      await expect(
        recordAttackEvent(mockSensor.uuid, 'invalid-ip', 'TCP', {}, 80),
      ).rejects.toThrow(AttackValidationError);

      await expect(
        recordAttackEvent(mockSensor.uuid, 'invalid-ip', 'TCP', {}, 80),
      ).rejects.toThrow('Invalid source IP address');
    });

    it('should throw AttackValidationError for invalid protocol', async () => {
      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'INVALID_PROTOCOL', {}),
      ).rejects.toThrow(AttackValidationError);

      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'INVALID_PROTOCOL', {}),
      ).rejects.toThrow('Invalid protocol');
    });

    it('should throw AttackValidationError for invalid port', async () => {
      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'TCP', {}, 70000),
      ).rejects.toThrow(AttackValidationError);

      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'TCP', {}, 0),
      ).rejects.toThrow('Invalid port number');
    });

    it('should throw AttackValidationError for invalid coordinates', async () => {
      await expect(
        recordAttackEvent(
          mockSensor.uuid,
          '10.0.0.1',
          'TCP',
          {},
          80,
          'US',
          'Portland',
          200, // Invalid latitude
          -122.6,
        ),
      ).rejects.toThrow(AttackValidationError);

      await expect(
        recordAttackEvent(
          mockSensor.uuid,
          '10.0.0.1',
          'TCP',
          {},
          80,
          'US',
          'Portland',
          200,
          -122.6,
        ),
      ).rejects.toThrow('Invalid coordinates');
    });

    it('should throw SensorNotFoundError when sensor does not exist', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      await expect(
        recordAttackEvent('non-existent-uuid', '10.0.0.1', 'TCP', {}),
      ).rejects.toThrow(SensorNotFoundError);

      await expect(
        recordAttackEvent('non-existent-uuid', '10.0.0.1', 'TCP', {}),
      ).rejects.toThrow('Sensor with UUID non-existent-uuid not found');
    });

    it('should handle optional fields correctly', async () => {
      const mockMongoId = new ObjectId();
      const mockAttack = {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        port: null,
        timestamp: expect.any(Date),
        sensorId: mockSensor.id,
        mongoId: mockMongoId.toString(),
        country: null,
        city: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      mockMongoCollection.insertOne.mockResolvedValue({
        insertedId: mockMongoId,
        acknowledged: true,
      });
      prismaMock.attack.create.mockResolvedValue(mockAttack);

      const result = await recordAttackEvent(
        mockSensor.uuid,
        '10.0.0.1',
        'TCP',
        { test: 'minimal data' },
        // No optional fields
      );

      expect(result).toEqual({
        attackId: mockAttack.id,
        mongoId: mockMongoId.toString(),
      });
    });

    it('should throw AttackStorageError when MongoDB insertion fails', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      mockMongoCollection.insertOne.mockRejectedValue(
        new Error('MongoDB connection failed'),
      );

      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'TCP', {}),
      ).rejects.toThrow(AttackStorageError);

      await expect(
        recordAttackEvent(mockSensor.uuid, '10.0.0.1', 'TCP', {}),
      ).rejects.toThrow('Failed to store attack event');
    });

    it('should normalize protocol to uppercase', async () => {
      const mockMongoId = new ObjectId();
      const mockAttack = {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'HTTP', // Should be uppercase
        port: 80,
        timestamp: expect.any(Date),
        sensorId: mockSensor.id,
        mongoId: mockMongoId.toString(),
        country: null,
        city: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      mockMongoCollection.insertOne.mockResolvedValue({
        insertedId: mockMongoId,
        acknowledged: true,
      });
      prismaMock.attack.create.mockResolvedValue(mockAttack);

      await recordAttackEvent(
        mockSensor.uuid,
        '10.0.0.1',
        'http', // lowercase
        {},
        80,
      );

      expect(prismaMock.attack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            protocol: 'HTTP', // Uppercase
          }),
        }),
      );
    });
  });

  // ===== GET ATTACKS BY DATE RANGE TESTS =====
  describe('getAttacksByDateRange()', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const mockAttacks = [
      {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        port: 445,
        timestamp: new Date('2024-01-15'),
        sensorId: 1,
        mongoId: 'mongo123',
        country: 'US',
        city: 'Portland',
        latitude: 45.5,
        longitude: -122.6,
        createdAt: new Date(),
        updatedAt: new Date(),
        sensor: {
          uuid: 'sensor-uuid-1',
          name: 'sensor-1',
          honeypot: 'dionaea',
        },
      },
      {
        id: 2,
        sourceIp: '10.0.0.2',
        protocol: 'HTTP',
        port: 80,
        timestamp: new Date('2024-01-20'),
        sensorId: 2,
        mongoId: 'mongo456',
        country: 'CN',
        city: 'Beijing',
        latitude: 39.9,
        longitude: 116.4,
        createdAt: new Date(),
        updatedAt: new Date(),
        sensor: {
          uuid: 'sensor-uuid-2',
          name: 'sensor-2',
          honeypot: 'cowrie',
        },
      },
    ];

    it('should return all attacks in date range without filters', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(100); // Total
      prismaMock.attack.count.mockResolvedValueOnce(100); // Filtered
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getAttacksByDateRange(startDate, endDate);

      expect(result).toEqual({
        attacks: mockAttacks,
        total: 100,
        filtered: 100,
      });

      expect(prismaMock.attack.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by sensorId', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(100); // Total
      prismaMock.attack.count.mockResolvedValueOnce(50); // Filtered
      prismaMock.attack.findMany.mockResolvedValue([mockAttacks[0]]);

      const result = await getAttacksByDateRange(startDate, endDate, {
        sensorId: 1,
      });

      expect(result.filtered).toBe(50);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sensorId: 1,
          }),
        }),
      );
    });

    it('should filter by sourceIp', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(10);
      prismaMock.attack.findMany.mockResolvedValue([mockAttacks[0]]);

      const result = await getAttacksByDateRange(startDate, endDate, {
        sourceIp: '10.0.0.1',
      });

      expect(result.filtered).toBe(10);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceIp: '10.0.0.1',
          }),
        }),
      );
    });

    it('should filter by protocol', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(30);
      prismaMock.attack.findMany.mockResolvedValue([mockAttacks[0]]);

      await getAttacksByDateRange(startDate, endDate, {
        protocol: 'tcp',
      });

      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            protocol: 'TCP', // Normalized to uppercase
          }),
        }),
      );
    });

    it('should respect pagination (limit and offset)', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.count.mockResolvedValueOnce(100);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      await getAttacksByDateRange(startDate, endDate, {
        limit: 50,
        offset: 25,
      });

      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 50,
        }),
      );
    });

    it('should return correct total and filtered counts', async () => {
      prismaMock.attack.count.mockResolvedValueOnce(1000); // Total
      prismaMock.attack.count.mockResolvedValueOnce(150); // Filtered
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getAttacksByDateRange(startDate, endDate, {
        sensorId: 1,
        protocol: 'TCP',
      });

      expect(result.total).toBe(1000);
      expect(result.filtered).toBe(150);
    });
  });

  // ===== GET ATTACK STATISTICS TESTS =====
  describe('getAttackStatistics()', () => {
    it('should return complete attack statistics', async () => {
      prismaMock.attack.count.mockResolvedValue(1000);
      prismaMock.attack.findMany.mockResolvedValue(
        Array.from({ length: 250 }, (_, i) => ({
          sourceIp: `10.0.0.${i}`,
        })) as any,
      );
      prismaMock.attack.groupBy
        .mockResolvedValueOnce([
          { protocol: 'TCP', _count: { protocol: 500 } },
          { protocol: 'HTTP', _count: { protocol: 300 } },
          { protocol: 'SSH', _count: { protocol: 200 } },
        ] as any)
        .mockResolvedValueOnce([
          { country: 'US', _count: { country: 400 } },
          { country: 'CN', _count: { country: 300 } },
          { country: 'RU', _count: { country: 200 } },
        ] as any)
        .mockResolvedValueOnce([
          { sensorId: 1, _count: { sensorId: 600 } },
          { sensorId: 2, _count: { sensorId: 400 } },
        ] as any);

      prismaMock.attack.findMany.mockResolvedValue([
        {
          id: 1,
          sourceIp: '10.0.0.1',
          protocol: 'TCP',
          port: 445,
          timestamp: new Date('2024-01-15'),
          sensorId: 1,
          mongoId: 'mongo123',
          country: 'US',
          city: 'Portland',
          latitude: 45.5,
          longitude: -122.6,
          createdAt: new Date(),
          updatedAt: new Date(),
          sensor: {
            id: 1,
            uuid: 'uuid-1',
            name: 'sensor-1',
            hostname: 'host-1',
            ip: '192.168.1.1',
            identifier: 'uuid-1',
            honeypot: 'dionaea',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ] as any);

      prismaMock.sensor.findMany.mockResolvedValue([
        {
          id: 1,
          uuid: 'uuid-1',
          name: 'sensor-1',
          hostname: 'host-1',
          ip: '192.168.1.1',
          identifier: 'uuid-1',
          honeypot: 'dionaea',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          uuid: 'uuid-2',
          name: 'sensor-2',
          hostname: 'host-2',
          ip: '192.168.1.2',
          identifier: 'uuid-2',
          honeypot: 'cowrie',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      prismaMock.attack.aggregate.mockResolvedValue({
        _min: { timestamp: new Date('2024-01-01') },
        _max: { timestamp: new Date('2024-01-31') },
      } as any);

      const result = await getAttackStatistics(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.totalAttacks).toBe(1000);
      expect(result.uniqueAttackers).toBeGreaterThan(0);
      expect(result.topProtocols).toBeDefined();
      expect(result.topCountries).toBeDefined();
      expect(result.attacksByHoneypot).toBeDefined();
      expect(result.attacksBySensor).toBeDefined();
      expect(result.timeRange).toBeDefined();
    });

    it('should handle empty result set', async () => {
      prismaMock.attack.count.mockResolvedValue(0);
      prismaMock.attack.findMany.mockResolvedValue([]);
      prismaMock.attack.groupBy.mockResolvedValue([]);
      prismaMock.attack.aggregate.mockResolvedValue({
        _min: { timestamp: new Date() },
        _max: { timestamp: new Date() },
      } as any);

      const result = await getAttackStatistics();

      expect(result.totalAttacks).toBe(0);
      expect(result.uniqueAttackers).toBe(0);
      expect(result.topProtocols).toEqual([]);
      expect(result.topCountries).toEqual([]);
    });

    it('should use date range when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue([]);
      prismaMock.attack.groupBy.mockResolvedValue([]);
      prismaMock.attack.aggregate.mockResolvedValue({
        _min: { timestamp: startDate },
        _max: { timestamp: endDate },
      } as any);

      await getAttackStatistics(startDate, endDate);

      expect(prismaMock.attack.count).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });

    it('should include all required fields in response', async () => {
      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue([
        { sourceIp: '10.0.0.1' },
        { sourceIp: '10.0.0.2' },
      ] as any);
      prismaMock.attack.groupBy.mockResolvedValue([]);
      prismaMock.attack.aggregate.mockResolvedValue({
        _min: { timestamp: new Date() },
        _max: { timestamp: new Date() },
      } as any);

      const result = await getAttackStatistics();

      expect(result).toHaveProperty('totalAttacks');
      expect(result).toHaveProperty('uniqueAttackers');
      expect(result).toHaveProperty('topProtocols');
      expect(result).toHaveProperty('topCountries');
      expect(result).toHaveProperty('attacksByHoneypot');
      expect(result).toHaveProperty('attacksBySensor');
      expect(result).toHaveProperty('timeRange');
      expect(result.timeRange).toHaveProperty('start');
      expect(result.timeRange).toHaveProperty('end');
    });
  });

  // ===== GET TOP ATTACKERS TESTS =====
  describe('getTopAttackers()', () => {
    const mockAttacks = [
      {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        port: 445,
        timestamp: new Date(),
        sensorId: 1,
        mongoId: 'mongo123',
        country: 'US',
        city: 'Portland',
        latitude: 45.5,
        longitude: -122.6,
        createdAt: new Date(),
        updatedAt: new Date(),
        sensor: {
          id: 1,
          uuid: 'uuid-1',
          name: 'sensor-1',
          hostname: 'host-1',
          ip: '192.168.1.1',
          identifier: 'uuid-1',
          honeypot: 'dionaea',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    it('should return top 10 attackers by default', async () => {
      prismaMock.attack.groupBy.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          sourceIp: `10.0.0.${i}`,
          _count: { sourceIp: 100 - i * 10 },
        })) as any,
      );
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getTopAttackers();

      expect(result).toHaveLength(10);
      expect(prismaMock.attack.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should respect custom limit', async () => {
      prismaMock.attack.groupBy.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          sourceIp: `10.0.0.${i}`,
          _count: { sourceIp: 50 - i * 10 },
        })) as any,
      );
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getTopAttackers(5);

      expect(result).toHaveLength(5);
    });

    it('should include protocol and sensor lists per IP', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([
        { sourceIp: '10.0.0.1', _count: { sourceIp: 100 } },
      ] as any);
      prismaMock.attack.findMany.mockResolvedValue([
        { ...mockAttacks[0], protocol: 'TCP', sensor: { name: 'sensor-1' } },
        { ...mockAttacks[0], protocol: 'HTTP', sensor: { name: 'sensor-2' } },
        { ...mockAttacks[0], protocol: 'TCP', sensor: { name: 'sensor-1' } },
      ] as any);

      const result = await getTopAttackers(1);

      expect(result[0].protocols).toContain('TCP');
      expect(result[0].protocols).toContain('HTTP');
      expect(result[0].sensorsHit).toContain('sensor-1');
      expect(result[0].sensorsHit).toContain('sensor-2');
    });

    it('should handle empty result', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([]);

      const result = await getTopAttackers();

      expect(result).toEqual([]);
    });
  });

  // ===== GET ATTACKS BY SENSOR TESTS =====
  describe('getAttacksBySensor()', () => {
    const mockSensor = {
      id: 1,
      uuid: 'uuid-1',
      name: 'sensor-1',
      hostname: 'host-1',
      ip: '192.168.1.1',
      identifier: 'uuid-1',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockAttacks = [
      {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        port: 445,
        timestamp: new Date(),
        sensorId: 1,
        mongoId: 'mongo123',
        country: 'US',
        city: 'Portland',
        latitude: 45.5,
        longitude: -122.6,
        createdAt: new Date(),
        updatedAt: new Date(),
        sensor: {
          uuid: 'uuid-1',
          name: 'sensor-1',
          honeypot: 'dionaea',
        },
      },
    ];

    it('should return attacks for specific sensor', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getAttacksBySensor(1);

      expect(result.attacks).toEqual(mockAttacks);
      expect(result.total).toBe(100);
    });

    it('should throw SensorNotFoundError if sensor does not exist', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      await expect(getAttacksBySensor(999)).rejects.toThrow(
        SensorNotFoundError,
      );
      await expect(getAttacksBySensor(999)).rejects.toThrow(
        'Sensor with ID 999 not found',
      );
    });

    it('should respect pagination', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.attack.count.mockResolvedValue(100);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      await getAttacksBySensor(1, 50, 25);

      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 50,
        }),
      );
    });

    it('should return correct total count', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.attack.count.mockResolvedValue(500);
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await getAttacksBySensor(1);

      expect(result.total).toBe(500);
    });
  });

  // ===== GET ATTACK DETAIL TESTS =====
  describe('getAttackDetail()', () => {
    it('should return attack document from MongoDB', async () => {
      const mockMongoId = new ObjectId();
      const mockAttackDoc = {
        _id: mockMongoId,
        sensorUuid: 'uuid-1',
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        timestamp: new Date(),
        honeypotType: 'dionaea',
        payload: { test: 'data' },
      };

      mockMongoCollection.findOne.mockResolvedValue(mockAttackDoc);

      const result = await getAttackDetail(mockMongoId.toString());

      expect(result).toEqual(mockAttackDoc);
      expect(mockMongoCollection.findOne).toHaveBeenCalledWith({
        _id: mockMongoId,
      });
    });

    it('should return null if attack not found', async () => {
      mockMongoCollection.findOne.mockResolvedValue(null);

      const result = await getAttackDetail(new ObjectId().toString());

      expect(result).toBeNull();
    });

    it('should return null for invalid ObjectId format', async () => {
      const result = await getAttackDetail('invalid-id');

      expect(result).toBeNull();
    });
  });

  // ===== GET GEO STATISTICS TESTS =====
  describe('getGeoStatistics()', () => {
    it('should return geographic aggregation', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([
        { country: 'US', _count: { country: 500 } },
        { country: 'CN', _count: { country: 300 } },
      ] as any);

      prismaMock.attack.findMany
        .mockResolvedValueOnce([
          { sourceIp: '10.0.0.1' },
          { sourceIp: '10.0.0.2' },
        ] as any)
        .mockResolvedValueOnce([{ latitude: 45.5, longitude: -122.6 }] as any)
        .mockResolvedValueOnce([
          { sourceIp: '20.0.0.1' },
          { sourceIp: '20.0.0.2' },
          { sourceIp: '20.0.0.3' },
        ] as any)
        .mockResolvedValueOnce([{ latitude: 39.9, longitude: 116.4 }] as any);

      const result = await getGeoStatistics();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('country');
      expect(result[0]).toHaveProperty('latitude');
      expect(result[0]).toHaveProperty('longitude');
      expect(result[0]).toHaveProperty('attackCount');
      expect(result[0]).toHaveProperty('uniqueIps');
    });

    it('should include coordinates and counts', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([
        { country: 'US', _count: { country: 100 } },
      ] as any);

      prismaMock.attack.findMany
        .mockResolvedValueOnce([
          { sourceIp: '10.0.0.1' },
          { sourceIp: '10.0.0.2' },
        ] as any)
        .mockResolvedValueOnce([{ latitude: 45.5, longitude: -122.6 }] as any);

      const result = await getGeoStatistics();

      expect(result[0].attackCount).toBe(100);
      expect(result[0].uniqueIps).toBe(2);
      expect(result[0].latitude).toBe(45.5);
      expect(result[0].longitude).toBe(-122.6);
    });

    it('should be sorted by attack count', async () => {
      prismaMock.attack.groupBy.mockResolvedValue([
        { country: 'US', _count: { country: 300 } },
        { country: 'CN', _count: { country: 500 } },
        { country: 'RU', _count: { country: 100 } },
      ] as any);

      prismaMock.attack.findMany.mockResolvedValue([
        { sourceIp: '1.1.1.1', latitude: 1, longitude: 1 },
      ] as any);

      const result = await getGeoStatistics();

      expect(result[0].attackCount).toBeGreaterThanOrEqual(
        result[1]?.attackCount || 0,
      );
    });
  });

  // ===== SEARCH ATTACKS BY IP TESTS =====
  describe('searchAttacksByIp()', () => {
    const mockAttacks = [
      {
        id: 1,
        sourceIp: '10.0.0.1',
        protocol: 'TCP',
        port: 445,
        timestamp: new Date(),
        sensorId: 1,
        mongoId: 'mongo123',
        country: 'US',
        city: 'Portland',
        latitude: 45.5,
        longitude: -122.6,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should find all attacks from specific IP', async () => {
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      const result = await searchAttacksByIp('10.0.0.1');

      expect(result).toEqual(mockAttacks);
      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sourceIp: '10.0.0.1' },
        }),
      );
    });

    it('should respect limit parameter', async () => {
      prismaMock.attack.findMany.mockResolvedValue(mockAttacks);

      await searchAttacksByIp('10.0.0.1', 100);

      expect(prismaMock.attack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should throw AttackValidationError for invalid IP', async () => {
      await expect(searchAttacksByIp('invalid-ip')).rejects.toThrow(
        AttackValidationError,
      );
    });
  });

  // ===== GET ATTACKS BY HONEYPOT TESTS =====
  describe('getAttacksByHoneypot()', () => {
    it('should count attacks for specific honeypot type', async () => {
      const mockSensors = [
        {
          id: 1,
          uuid: 'uuid-1',
          name: 'sensor-1',
          hostname: 'host-1',
          ip: '192.168.1.1',
          identifier: 'uuid-1',
          honeypot: 'dionaea',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          uuid: 'uuid-2',
          name: 'sensor-2',
          hostname: 'host-2',
          ip: '192.168.1.2',
          identifier: 'uuid-2',
          honeypot: 'dionaea',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);
      prismaMock.attack.count.mockResolvedValue(500);

      const result = await getAttacksByHoneypot('dionaea');

      expect(result).toBe(500);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: { honeypot: 'dionaea' },
      });
      expect(prismaMock.attack.count).toHaveBeenCalledWith({
        where: {
          sensorId: { in: [1, 2] },
        },
      });
    });

    it('should return 0 if no sensors of that type exist', async () => {
      prismaMock.sensor.findMany.mockResolvedValue([]);

      const result = await getAttacksByHoneypot('non-existent');

      expect(result).toBe(0);
      expect(prismaMock.attack.count).not.toHaveBeenCalled();
    });
  });
});
