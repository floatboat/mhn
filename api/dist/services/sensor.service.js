"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensorExistsError = exports.SensorNotFoundError = void 0;
exports.registerSensor = registerSensor;
exports.getSensorByUuid = getSensorByUuid;
exports.getAllSensors = getAllSensors;
exports.updateSensor = updateSensor;
exports.deleteSensor = deleteSensor;
exports.recordSensorConnection = recordSensorConnection;
exports.countSensors = countSensors;
exports.sensorExistsByUuid = sensorExistsByUuid;
exports.sensorExistsByName = sensorExistsByName;
exports.getSensorsByHoneypot = getSensorsByHoneypot;
const prisma_1 = require("../lib/prisma");
const uuid_1 = require("uuid");
/**
 * Custom error for sensor not found
 */
class SensorNotFoundError extends Error {
    constructor(message = 'Sensor not found') {
        super(message);
        this.statusCode = 404;
        this.name = 'SensorNotFoundError';
    }
}
exports.SensorNotFoundError = SensorNotFoundError;
/**
 * Custom error for sensor already exists
 */
class SensorExistsError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 409;
        this.name = 'SensorExistsError';
    }
}
exports.SensorExistsError = SensorExistsError;
/**
 * Registers a new sensor with deploy key authentication
 * Generates UUID v1 and sets identifier = uuid for HPFeeds compatibility
 * @param data - Sensor registration data
 * @returns Created sensor object
 * @throws SensorExistsError if sensor with same name already exists
 */
async function registerSensor(data) {
    // Check if sensor with same name already exists
    const existingSensor = await prisma_1.prisma.sensor.findFirst({
        where: { name: data.name },
    });
    if (existingSensor) {
        throw new SensorExistsError(`Sensor with name '${data.name}' already exists`);
    }
    // Generate UUID v1 for sensor
    const uuid = (0, uuid_1.v1)();
    // Create sensor in database
    // identifier is same as uuid for HPFeeds compatibility
    const sensor = await prisma_1.prisma.sensor.create({
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
async function getSensorByUuid(uuid) {
    const sensor = await prisma_1.prisma.sensor.findUnique({
        where: { uuid },
    });
    return sensor;
}
/**
 * Lists all sensors with optional filtering
 * @param filters - Optional filter criteria
 * @returns Array of sensor objects
 */
async function getAllSensors(filters) {
    // Build where clause based on filters
    const where = {};
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
    const sensors = await prisma_1.prisma.sensor.findMany({
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
async function updateSensor(uuid, data) {
    // Verify sensor exists
    const existingSensor = await prisma_1.prisma.sensor.findUnique({
        where: { uuid },
    });
    if (!existingSensor) {
        throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
    }
    // If name is being changed, check for conflicts
    if (data.name && data.name !== existingSensor.name) {
        const conflictingSensor = await prisma_1.prisma.sensor.findFirst({
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
    const updatedSensor = await prisma_1.prisma.sensor.update({
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
async function deleteSensor(uuid) {
    // Verify sensor exists
    const sensor = await prisma_1.prisma.sensor.findUnique({
        where: { uuid },
    });
    if (!sensor) {
        throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
    }
    // Delete sensor
    await prisma_1.prisma.sensor.delete({
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
async function recordSensorConnection(uuid, ip) {
    // Verify sensor exists
    const sensor = await prisma_1.prisma.sensor.findUnique({
        where: { uuid },
    });
    if (!sensor) {
        throw new SensorNotFoundError(`Sensor with UUID '${uuid}' not found`);
    }
    // Update IP and timestamp (updatedAt is automatically updated)
    const updatedSensor = await prisma_1.prisma.sensor.update({
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
async function countSensors(honeypot) {
    const where = honeypot ? { honeypot } : {};
    return prisma_1.prisma.sensor.count({ where });
}
/**
 * Checks if a sensor exists by UUID
 * @param uuid - Sensor UUID to check
 * @returns True if sensor exists
 */
async function sensorExistsByUuid(uuid) {
    const count = await prisma_1.prisma.sensor.count({
        where: { uuid },
    });
    return count > 0;
}
/**
 * Checks if a sensor exists by name
 * @param name - Sensor name to check
 * @returns True if sensor exists
 */
async function sensorExistsByName(name) {
    const count = await prisma_1.prisma.sensor.count({
        where: { name },
    });
    return count > 0;
}
/**
 * Gets sensors by honeypot type
 * @param honeypot - Honeypot type (dionaea, cowrie, conpot, etc.)
 * @returns Array of sensors matching the honeypot type
 */
async function getSensorsByHoneypot(honeypot) {
    return prisma_1.prisma.sensor.findMany({
        where: { honeypot },
        orderBy: {
            createdAt: 'desc',
        },
    });
}
