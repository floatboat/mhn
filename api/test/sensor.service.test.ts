// test/sensor.service.test.ts
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
  v1: jest.fn(),
}));

import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import * as uuidModule from 'uuid';
import {
  registerSensor,
  getSensorByUuid,
  getAllSensors,
  updateSensor,
  deleteSensor,
  recordSensorConnection,
  countSensors,
  sensorExistsByUuid,
  sensorExistsByName,
  getSensorsByHoneypot,
  SensorNotFoundError,
  SensorExistsError,
  RegisterSensorData,
  UpdateSensorData,
  SensorFilters,
} from '../src/services/sensor.service';

describe('Sensor Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const uuidMock = uuidModule.v1 as jest.MockedFunction<typeof uuidModule.v1>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerSensor()', () => {
    const mockUuid = '550e8400-e29b-11d4-a716-446655440000';
    const sensorData: RegisterSensorData = {
      name: 'test-sensor',
      hostname: 'sensor.example.com',
      honeypot: 'dionaea',
      ip: '192.168.1.100',
    };

    const mockCreatedSensor = {
      id: 1,
      uuid: mockUuid,
      identifier: mockUuid,
      name: sensorData.name,
      hostname: sensorData.hostname,
      ip: sensorData.ip,
      honeypot: sensorData.honeypot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a new sensor with auto-generated UUID', async () => {
      uuidMock.mockReturnValue(mockUuid as any);
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.create.mockResolvedValue(mockCreatedSensor);

      const result = await registerSensor(sensorData);

      expect(result).toEqual(mockCreatedSensor);
      expect(uuidMock).toHaveBeenCalled();
      expect(prismaMock.sensor.findFirst).toHaveBeenCalledWith({
        where: { name: sensorData.name },
      });
      expect(prismaMock.sensor.create).toHaveBeenCalledWith({
        data: {
          uuid: mockUuid,
          identifier: mockUuid,
          name: sensorData.name,
          hostname: sensorData.hostname,
          ip: sensorData.ip,
          honeypot: sensorData.honeypot,
        },
      });
    });

    it('should throw SensorExistsError when sensor with same name exists', async () => {
      const existingSensor = { ...mockCreatedSensor, id: 2 };
      prismaMock.sensor.findFirst.mockResolvedValue(existingSensor);

      await expect(registerSensor(sensorData)).rejects.toThrow(
        SensorExistsError,
      );
      await expect(registerSensor(sensorData)).rejects.toThrow(
        `Sensor with name '${sensorData.name}' already exists`,
      );
      expect(prismaMock.sensor.create).not.toHaveBeenCalled();
    });

    it('should set identifier equal to uuid', async () => {
      uuidMock.mockReturnValue(mockUuid as any);
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.create.mockResolvedValue(mockCreatedSensor);

      const result = await registerSensor(sensorData);

      expect(result.uuid).toBe(result.identifier);
    });
  });

  describe('getSensorByUuid()', () => {
    const mockUuid = '550e8400-e29b-11d4-a716-446655440000';
    const mockSensor = {
      id: 1,
      uuid: mockUuid,
      identifier: mockUuid,
      name: 'test-sensor',
      hostname: 'sensor.example.com',
      ip: '192.168.1.100',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return sensor when found', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);

      const result = await getSensorByUuid(mockUuid);

      expect(result).toEqual(mockSensor);
      expect(prismaMock.sensor.findUnique).toHaveBeenCalledWith({
        where: { uuid: mockUuid },
      });
    });

    it('should return null when sensor not found', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      const result = await getSensorByUuid('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('getAllSensors()', () => {
    const mockSensors = [
      {
        id: 1,
        uuid: '550e8400-e29b-11d4-a716-446655440000',
        identifier: '550e8400-e29b-11d4-a716-446655440000',
        name: 'sensor1',
        hostname: 'sensor1.example.com',
        ip: '192.168.1.100',
        honeypot: 'dionaea',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 2,
        uuid: '550e8400-e29b-11d4-a716-446655440001',
        identifier: '550e8400-e29b-11d4-a716-446655440001',
        name: 'sensor2',
        hostname: 'sensor2.example.com',
        ip: '192.168.1.101',
        honeypot: 'cowrie',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    it('should return all sensors when no filters provided', async () => {
      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const result = await getAllSensors();

      expect(result).toEqual(mockSensors);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter sensors by honeypot type', async () => {
      const filters: SensorFilters = { honeypot: 'dionaea' };
      prismaMock.sensor.findMany.mockResolvedValue([mockSensors[0]]);

      const result = await getAllSensors(filters);

      expect(result).toEqual([mockSensors[0]]);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: { honeypot: 'dionaea' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter sensors by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters: SensorFilters = { startDate, endDate };

      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const result = await getAllSensors(filters);

      expect(result).toEqual(mockSensors);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should combine multiple filters', async () => {
      const startDate = new Date('2024-01-01');
      const filters: SensorFilters = {
        honeypot: 'dionaea',
        startDate,
      };

      prismaMock.sensor.findMany.mockResolvedValue([mockSensors[0]]);

      const result = await getAllSensors(filters);

      expect(result).toEqual([mockSensors[0]]);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: {
          honeypot: 'dionaea',
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateSensor()', () => {
    const mockUuid = '550e8400-e29b-11d4-a716-446655440000';
    const existingSensor = {
      id: 1,
      uuid: mockUuid,
      identifier: mockUuid,
      name: 'old-name',
      hostname: 'old.example.com',
      ip: '192.168.1.100',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update sensor name and hostname', async () => {
      const updateData: UpdateSensorData = {
        name: 'new-name',
        hostname: 'new.example.com',
      };
      const updatedSensor = { ...existingSensor, ...updateData };

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.findFirst.mockResolvedValue(null);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const result = await updateSensor(mockUuid, updateData);

      expect(result).toEqual(updatedSensor);
      expect(prismaMock.sensor.update).toHaveBeenCalledWith({
        where: { uuid: mockUuid },
        data: updateData,
      });
    });

    it('should throw SensorNotFoundError when sensor does not exist', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      await expect(
        updateSensor('nonexistent-uuid', { name: 'new-name' }),
      ).rejects.toThrow(SensorNotFoundError);
      await expect(
        updateSensor('nonexistent-uuid', { name: 'new-name' }),
      ).rejects.toThrow("Sensor with UUID 'nonexistent-uuid' not found");
    });

    it('should throw SensorExistsError when new name is already taken', async () => {
      const conflictingSensor = {
        ...existingSensor,
        id: 2,
        uuid: 'different-uuid',
        name: 'new-name',
      };

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.findFirst.mockResolvedValue(conflictingSensor);

      await expect(
        updateSensor(mockUuid, { name: 'new-name' }),
      ).rejects.toThrow(SensorExistsError);
    });

    it('should allow updating to same name (no conflict)', async () => {
      const updateData: UpdateSensorData = { hostname: 'new.example.com' };
      const updatedSensor = { ...existingSensor, ...updateData };

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const result = await updateSensor(mockUuid, updateData);

      expect(result).toEqual(updatedSensor);
      // Should not check for name conflict when name is not being changed
      expect(prismaMock.sensor.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('deleteSensor()', () => {
    const mockUuid = '550e8400-e29b-11d4-a716-446655440000';
    const mockSensor = {
      id: 1,
      uuid: mockUuid,
      identifier: mockUuid,
      name: 'test-sensor',
      hostname: 'sensor.example.com',
      ip: '192.168.1.100',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete sensor successfully', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(mockSensor);
      prismaMock.sensor.delete.mockResolvedValue(mockSensor);

      const result = await deleteSensor(mockUuid);

      expect(result).toBe(true);
      expect(prismaMock.sensor.delete).toHaveBeenCalledWith({
        where: { uuid: mockUuid },
      });
    });

    it('should throw SensorNotFoundError when sensor does not exist', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      await expect(deleteSensor('nonexistent-uuid')).rejects.toThrow(
        SensorNotFoundError,
      );
      expect(prismaMock.sensor.delete).not.toHaveBeenCalled();
    });
  });

  describe('recordSensorConnection()', () => {
    const mockUuid = '550e8400-e29b-11d4-a716-446655440000';
    const existingSensor = {
      id: 1,
      uuid: mockUuid,
      identifier: mockUuid,
      name: 'test-sensor',
      hostname: 'sensor.example.com',
      ip: '192.168.1.100',
      honeypot: 'dionaea',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update sensor IP and timestamp', async () => {
      const newIp = '192.168.1.200';
      const updatedSensor = {
        ...existingSensor,
        ip: newIp,
        updatedAt: new Date(),
      };

      prismaMock.sensor.findUnique.mockResolvedValue(existingSensor);
      prismaMock.sensor.update.mockResolvedValue(updatedSensor);

      const result = await recordSensorConnection(mockUuid, newIp);

      expect(result).toEqual(updatedSensor);
      expect(prismaMock.sensor.update).toHaveBeenCalledWith({
        where: { uuid: mockUuid },
        data: { ip: newIp },
      });
    });

    it('should throw SensorNotFoundError when sensor does not exist', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue(null);

      await expect(
        recordSensorConnection('nonexistent-uuid', '192.168.1.200'),
      ).rejects.toThrow(SensorNotFoundError);
      expect(prismaMock.sensor.update).not.toHaveBeenCalled();
    });
  });

  describe('countSensors()', () => {
    it('should return total count when no filter provided', async () => {
      prismaMock.sensor.count.mockResolvedValue(10);

      const result = await countSensors();

      expect(result).toBe(10);
      expect(prismaMock.sensor.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should return filtered count by honeypot type', async () => {
      prismaMock.sensor.count.mockResolvedValue(5);

      const result = await countSensors('dionaea');

      expect(result).toBe(5);
      expect(prismaMock.sensor.count).toHaveBeenCalledWith({
        where: { honeypot: 'dionaea' },
      });
    });
  });

  describe('sensorExistsByUuid()', () => {
    it('should return true when sensor exists', async () => {
      prismaMock.sensor.count.mockResolvedValue(1);

      const result = await sensorExistsByUuid('existing-uuid');

      expect(result).toBe(true);
      expect(prismaMock.sensor.count).toHaveBeenCalledWith({
        where: { uuid: 'existing-uuid' },
      });
    });

    it('should return false when sensor does not exist', async () => {
      prismaMock.sensor.count.mockResolvedValue(0);

      const result = await sensorExistsByUuid('nonexistent-uuid');

      expect(result).toBe(false);
    });
  });

  describe('sensorExistsByName()', () => {
    it('should return true when sensor exists', async () => {
      prismaMock.sensor.count.mockResolvedValue(1);

      const result = await sensorExistsByName('test-sensor');

      expect(result).toBe(true);
      expect(prismaMock.sensor.count).toHaveBeenCalledWith({
        where: { name: 'test-sensor' },
      });
    });

    it('should return false when sensor does not exist', async () => {
      prismaMock.sensor.count.mockResolvedValue(0);

      const result = await sensorExistsByName('nonexistent-sensor');

      expect(result).toBe(false);
    });
  });

  describe('getSensorsByHoneypot()', () => {
    const mockSensors = [
      {
        id: 1,
        uuid: '550e8400-e29b-11d4-a716-446655440000',
        identifier: '550e8400-e29b-11d4-a716-446655440000',
        name: 'sensor1',
        hostname: 'sensor1.example.com',
        ip: '192.168.1.100',
        honeypot: 'dionaea',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        uuid: '550e8400-e29b-11d4-a716-446655440001',
        identifier: '550e8400-e29b-11d4-a716-446655440001',
        name: 'sensor2',
        hostname: 'sensor2.example.com',
        ip: '192.168.1.101',
        honeypot: 'dionaea',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return sensors matching honeypot type', async () => {
      prismaMock.sensor.findMany.mockResolvedValue(mockSensors);

      const result = await getSensorsByHoneypot('dionaea');

      expect(result).toEqual(mockSensors);
      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith({
        where: { honeypot: 'dionaea' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no sensors match', async () => {
      prismaMock.sensor.findMany.mockResolvedValue([]);

      const result = await getSensorsByHoneypot('cowrie');

      expect(result).toEqual([]);
    });
  });
});
