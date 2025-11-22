"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sensorRoutes;
const sensor_handler_1 = require("../../handlers/sensor.handler");
const sensor_types_1 = require("../../types/sensor.types");
async function sensorRoutes(fastify) {
    // Register new sensor
    // POST /api/sensor?deploy_key=xxx
    fastify.route({
        method: 'POST',
        url: '/sensor',
        schema: sensor_types_1.registerSensorSchema,
        handler: sensor_handler_1.registerSensorHandler,
    });
    // List all sensors with optional filtering
    // GET /api/sensor?api_key=xxx&honeypot=cowrie&startDate=2024-01-01&endDate=2024-12-31
    fastify.route({
        method: 'GET',
        url: '/sensor',
        schema: sensor_types_1.getSensorsSchema,
        handler: sensor_handler_1.getSensorsHandler,
    });
    // Get single sensor by UUID
    // GET /api/sensor/:uuid?api_key=xxx
    fastify.route({
        method: 'GET',
        url: '/sensor/:uuid',
        schema: sensor_types_1.getSensorSchema,
        handler: sensor_handler_1.getSensorHandler,
    });
    // Update sensor details
    // PUT /api/sensor/:uuid?api_key=xxx
    fastify.route({
        method: 'PUT',
        url: '/sensor/:uuid',
        schema: sensor_types_1.updateSensorSchema,
        handler: sensor_handler_1.updateSensorHandler,
    });
    // Delete sensor
    // DELETE /api/sensor/:uuid?api_key=xxx
    fastify.route({
        method: 'DELETE',
        url: '/sensor/:uuid',
        schema: sensor_types_1.deleteSensorSchema,
        handler: sensor_handler_1.deleteSensorHandler,
    });
    // Sensor check-in/heartbeat
    // POST /api/sensor/:uuid/connect?deploy_key=xxx
    fastify.route({
        method: 'POST',
        url: '/sensor/:uuid/connect',
        schema: sensor_types_1.sensorConnectSchema,
        handler: sensor_handler_1.sensorConnectHandler,
    });
}
