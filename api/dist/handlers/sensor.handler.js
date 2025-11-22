"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSensorHandler = registerSensorHandler;
exports.getSensorsHandler = getSensorsHandler;
exports.getSensorHandler = getSensorHandler;
exports.updateSensorHandler = updateSensorHandler;
exports.deleteSensorHandler = deleteSensorHandler;
exports.sensorConnectHandler = sensorConnectHandler;
const sensor_service_1 = require("../services/sensor.service");
/**
 * Helper function to extract client IP from request
 * Checks X-Forwarded-For header first, then falls back to socket remote address
 * @param request - Fastify request
 * @returns Client IP address
 */
function getClientIp(request) {
    // Check X-Forwarded-For header (if behind a proxy)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return ips.split(',')[0].trim();
    }
    // Use Fastify's built-in IP detection
    if (request.ip) {
        return request.ip;
    }
    // Fallback to socket remote address
    return request.socket.remoteAddress || 'unknown';
}
/**
 * Registers a new sensor
 * POST /api/sensor
 * Requires deploy_key in query string (for now - authentication not implemented)
 *
 * @param request - Fastify request with sensor registration data
 * @param reply - Fastify reply
 * @returns Created sensor object
 */
async function registerSensorHandler(request, reply) {
    try {
        const { name, hostname, honeypot } = request.body;
        const clientIp = getClientIp(request);
        request.log.info({ name, hostname, honeypot, ip: clientIp }, 'Registering sensor');
        const data = {
            name,
            hostname,
            honeypot,
            ip: clientIp,
        };
        const sensor = await (0, sensor_service_1.registerSensor)(data);
        request.log.info({ uuid: sensor.uuid }, 'Sensor registered successfully');
        // Return sensor with ISO date strings
        return reply.status(201).send({
            id: sensor.id,
            uuid: sensor.uuid,
            name: sensor.name,
            hostname: sensor.hostname,
            ip: sensor.ip,
            identifier: sensor.identifier,
            honeypot: sensor.honeypot,
            createdAt: sensor.createdAt.toISOString(),
            updatedAt: sensor.updatedAt.toISOString(),
        });
    }
    catch (error) {
        if (error instanceof sensor_service_1.SensorExistsError) {
            return reply.conflict(error.message);
        }
        request.log.error({ error }, 'Error registering sensor');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred registering sensor',
        });
    }
}
/**
 * Lists all sensors with optional filtering
 * GET /api/sensor
 * Requires api_key in query string (for now - authentication not implemented)
 *
 * @param request - Fastify request with optional query filters
 * @param reply - Fastify reply
 * @returns Array of sensors
 */
async function getSensorsHandler(request, reply) {
    try {
        const { honeypot, startDate, endDate } = request.query;
        // Build filters
        const filters = {};
        if (honeypot) {
            filters.honeypot = honeypot;
        }
        if (startDate) {
            filters.startDate = new Date(startDate);
        }
        if (endDate) {
            filters.endDate = new Date(endDate);
        }
        request.log.info({ filters }, 'Listing sensors');
        const sensors = await (0, sensor_service_1.getAllSensors)(filters);
        // Convert dates to ISO strings
        const sensorsResponse = sensors.map((sensor) => ({
            id: sensor.id,
            uuid: sensor.uuid,
            name: sensor.name,
            hostname: sensor.hostname,
            ip: sensor.ip,
            identifier: sensor.identifier,
            honeypot: sensor.honeypot,
            createdAt: sensor.createdAt.toISOString(),
            updatedAt: sensor.updatedAt.toISOString(),
        }));
        return reply.status(200).send(sensorsResponse);
    }
    catch (error) {
        request.log.error({ error }, 'Error listing sensors');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred listing sensors',
        });
    }
}
/**
 * Gets a single sensor by UUID
 * GET /api/sensor/:uuid
 * Requires api_key in query string (for now - authentication not implemented)
 *
 * @param request - Fastify request with sensor UUID
 * @param reply - Fastify reply
 * @returns Sensor object
 */
async function getSensorHandler(request, reply) {
    try {
        const { uuid } = request.params;
        request.log.info({ uuid }, 'Fetching sensor');
        const sensor = await (0, sensor_service_1.getSensorByUuid)(uuid);
        if (!sensor) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'Sensor not found',
            });
        }
        return reply.status(200).send({
            id: sensor.id,
            uuid: sensor.uuid,
            name: sensor.name,
            hostname: sensor.hostname,
            ip: sensor.ip,
            identifier: sensor.identifier,
            honeypot: sensor.honeypot,
            createdAt: sensor.createdAt.toISOString(),
            updatedAt: sensor.updatedAt.toISOString(),
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error fetching sensor');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred fetching sensor',
        });
    }
}
/**
 * Updates a sensor's details
 * PUT /api/sensor/:uuid
 * Requires api_key in query string (for now - authentication not implemented)
 *
 * @param request - Fastify request with sensor UUID and update data
 * @param reply - Fastify reply
 * @returns Updated sensor object
 */
async function updateSensorHandler(request, reply) {
    try {
        const { uuid } = request.params;
        const updates = request.body;
        request.log.info({ uuid, updates }, 'Updating sensor');
        const data = {};
        if (updates.name !== undefined)
            data.name = updates.name;
        if (updates.hostname !== undefined)
            data.hostname = updates.hostname;
        const sensor = await (0, sensor_service_1.updateSensor)(uuid, data);
        request.log.info({ uuid }, 'Sensor updated successfully');
        return reply.status(200).send({
            id: sensor.id,
            uuid: sensor.uuid,
            name: sensor.name,
            hostname: sensor.hostname,
            ip: sensor.ip,
            identifier: sensor.identifier,
            honeypot: sensor.honeypot,
            createdAt: sensor.createdAt.toISOString(),
            updatedAt: sensor.updatedAt.toISOString(),
        });
    }
    catch (error) {
        if (error instanceof sensor_service_1.SensorNotFoundError) {
            return reply.status(404).send({
                error: 'Not Found',
                message: error.message,
            });
        }
        if (error instanceof sensor_service_1.SensorExistsError) {
            return reply.conflict(error.message);
        }
        request.log.error({ error }, 'Error updating sensor');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred updating sensor',
        });
    }
}
/**
 * Deletes a sensor
 * DELETE /api/sensor/:uuid
 * Requires api_key in query string (for now - authentication not implemented)
 *
 * @param request - Fastify request with sensor UUID
 * @param reply - Fastify reply
 * @returns Success message
 */
async function deleteSensorHandler(request, reply) {
    try {
        const { uuid } = request.params;
        request.log.info({ uuid }, 'Deleting sensor');
        await (0, sensor_service_1.deleteSensor)(uuid);
        request.log.info({ uuid }, 'Sensor deleted successfully');
        return reply.status(200).send({
            message: 'Sensor deleted successfully',
        });
    }
    catch (error) {
        if (error instanceof sensor_service_1.SensorNotFoundError) {
            return reply.status(404).send({
                error: 'Not Found',
                message: error.message,
            });
        }
        request.log.error({ error }, 'Error deleting sensor');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred deleting sensor',
        });
    }
}
/**
 * Records a sensor connection (check-in/heartbeat)
 * POST /api/sensor/:uuid/connect
 * Requires deploy_key in query string (for now - authentication not implemented)
 * Updates the sensor's IP address and timestamp
 *
 * @param request - Fastify request with sensor UUID
 * @param reply - Fastify reply
 * @returns Success message with updated IP
 */
async function sensorConnectHandler(request, reply) {
    try {
        const { uuid } = request.params;
        const clientIp = getClientIp(request);
        request.log.info({ uuid, ip: clientIp }, 'Sensor check-in');
        const sensor = await (0, sensor_service_1.recordSensorConnection)(uuid, clientIp);
        request.log.info({ uuid }, 'Sensor check-in successful');
        return reply.status(200).send({
            message: 'Sensor check-in successful',
            ip: sensor.ip,
        });
    }
    catch (error) {
        if (error instanceof sensor_service_1.SensorNotFoundError) {
            return reply.status(404).send({
                error: 'Not Found',
                message: error.message,
            });
        }
        request.log.error({ error }, 'Error during sensor check-in');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred during sensor check-in',
        });
    }
}
