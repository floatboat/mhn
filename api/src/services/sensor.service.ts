import { prisma } from '../lib/prisma';
import { v1 as uuidv1 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Custom error for sensor not found
 */
export class SensorNotFoundError extends Error {
  statusCode = 404;
  constructor(message: string = 'Sensor not found') {
    super(message);
    this.name = 'SensorNotFoundError';
  }
}

/**
 * Custom error for sensor already exists
 */
export class SensorExistsError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'SensorExistsError';
  }
}

/**
 * Sensor response interface
 */
export interface SensorResponse {
  id: number;
  uuid: string;
  name: string;
  hostname: string;
  ip: string;
  identifier: string;
  honeypot: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required for sensor registration
 */
export interface RegisterSensorData {
  name: string;
  hostname: string;
  honeypot: string;
  ip: string; // Auto-detected from request, passed by handler
}

/**
 * Data for updating a sensor
 */
export interface UpdateSensorData {
  name?: string;
  hostname?: string;
  // Note: uuid, identifier, honeypot, ip are immutable
}

/**
 * Filter options for listing sensors
 */
export interface SensorFilters {
  honeypot?: string; // Filter by honeypot type
  startDate?: Date; // Filter by creation date (from)
  endDate?: Date; // Filter by creation date (to)
}

/**
 * Registers a new sensor with deploy key authentication
 * Generates UUID v1 and sets identifier = uuid for HPFeeds compatibility
 * @param data - Sensor registration data
 * @returns Created sensor object
 * @throws SensorExistsError if sensor with same name already exists
 */
export async function registerSensor(
  data: RegisterSensorData,
): Promise<SensorResponse> {
  // Check if sensor with same name already exists
  const existingSensor = await prisma.sensor.findFirst({
    where: { name: data.name },
  });

  if (existingSensor) {
    throw new SensorExistsError(`Sensor with name '${data.name}' already exists`);
  }

  // Generate UUID v1 for sensor
  const uuid = uuidv1();

  // Create sensor in database
  // identifier is same as uuid for HPFeeds compatibility
  const sensor = await prisma.sensor.create({
    data: {
      uuid,
      identifier: uuid, // Same as uuid for HPFeeds
      name: data.name,
      hostname: data.hostname,
      ip: data.ip,
      honeypot: data.honeypot,
    },
  });

  return sensor;
}

/**
 * Gets a sensor by UUID
 * @param uuid - Sensor UUID (v1)
 * @returns Sensor object or null if not found
 */
export async function getSensorByUuid(uuid: string): Promise<SensorResponse | null> {
  const sensor = await prisma.sensor.findUnique({
    where: { uuid },
  });

  return sensor;
}

/**
 * Lists all sensors with optional filtering
 * @param filters - Optional filter criteria
 * @returns Array of sensor objects
 */
export async function getAllSensors(
  filters?: SensorFilters,
): Promise<SensorResponse[]> {
  // Build where clause based on filters
  const where: Prisma.SensorWhereInput = {};

  if (filters?.honeypot) {
    where.honeypot = filters.honeypot;
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const sensors = await prisma.sensor.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return sensors;
}

/**
 * Updates a sensor's details
 * Only allows updating mutable fields: name, hostname
 * Immutable fields: uuid, identifier, honeypot, ip
 * @param uuid - Sensor UUID
 * @param data - Fields to update
 * @returns Updated sensor object
 * @throws SensorNotFoundError if sensor doesn't exist
 * @throws SensorExistsError if new name is already taken
 */
export async function updateSensor(
  uuid: string,
  data: UpdateSensorData,
): Promise<SensorResponse> {
  // Verify sensor exists
  const existingSensor = await prisma.sensor.findUnique({
    where: { uuid },
  });

  if (!existingSensor) {
    throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
  }

  // If name is being changed, check for conflicts
  if (data.name && data.name !== existingSensor.name) {
    const conflictingSensor = await prisma.sensor.findFirst({
      where: {
        name: data.name,
        uuid: { not: uuid }, // Exclude current sensor
      },
    });

    if (conflictingSensor) {
      throw new SensorExistsError(`Sensor with name '${data.name}' already exists`);
    }
  }

  // Update sensor
  const updatedSensor = await prisma.sensor.update({
    where: { uuid },
    data,
  });

  return updatedSensor;
}

/**
 * Deletes a sensor
 * @param uuid - Sensor UUID
 * @returns True if deletion was successful
 * @throws SensorNotFoundError if sensor doesn't exist
 */
export async function deleteSensor(uuid: string): Promise<boolean> {
  // Verify sensor exists
  const sensor = await prisma.sensor.findUnique({
    where: { uuid },
  });

  if (!sensor) {
    throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
  }

  // Delete sensor
  await prisma.sensor.delete({
    where: { uuid },
  });

  return true;
}

/**
 * Records a sensor connection (check-in)
 * Updates the sensor's IP address and last seen timestamp
 * Note: updatedAt is automatically managed by Prisma
 * @param uuid - Sensor UUID
 * @param ip - Current IP address of sensor
 * @returns Updated sensor object
 * @throws SensorNotFoundError if sensor doesn't exist
 */
export async function recordSensorConnection(
  uuid: string,
  ip: string,
): Promise<SensorResponse> {
  // Verify sensor exists
  const sensor = await prisma.sensor.findUnique({
    where: { uuid },
  });

  if (!sensor) {
    throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
  }

  // Update IP and timestamp (updatedAt is automatically updated)
  const updatedSensor = await prisma.sensor.update({
    where: { uuid },
    data: {
      ip, // Update IP if changed
      // updatedAt is automatically managed by Prisma's @updatedAt
    },
  });

  return updatedSensor;
}

/**
 * Counts total number of sensors
 * @param honeypot - Optional filter by honeypot type
 * @returns Total number of sensors
 */
export async function countSensors(honeypot?: string): Promise<number> {
  const where: Prisma.SensorWhereInput = honeypot ? { honeypot } : {};

  return prisma.sensor.count({ where });
}

/**
 * Checks if a sensor exists by UUID
 * @param uuid - Sensor UUID to check
 * @returns True if sensor exists
 */
export async function sensorExistsByUuid(uuid: string): Promise<boolean> {
  const count = await prisma.sensor.count({
    where: { uuid },
  });

  return count > 0;
}

/**
 * Checks if a sensor exists by name
 * @param name - Sensor name to check
 * @returns True if sensor exists
 */
export async function sensorExistsByName(name: string): Promise<boolean> {
  const count = await prisma.sensor.count({
    where: { name },
  });

  return count > 0;
}

/**
 * Gets sensors by honeypot type
 * @param honeypot - Honeypot type (dionaea, cowrie, conpot, etc.)
 * @returns Array of sensors matching the honeypot type
 */
export async function getSensorsByHoneypot(
  honeypot: string,
): Promise<SensorResponse[]> {
  return prisma.sensor.findMany({
    where: { honeypot },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
