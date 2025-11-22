import { FastifyInstance } from 'fastify';
import {
  registerSensorHandler,
  getSensorsHandler,
  getSensorHandler,
  updateSensorHandler,
  deleteSensorHandler,
  sensorConnectHandler,
} from '../../handlers/sensor.handler';
import {
  registerSensorSchema,
  getSensorsSchema,
  getSensorSchema,
  updateSensorSchema,
  deleteSensorSchema,
  sensorConnectSchema,
} from '../../types/sensor.types';

export default async function sensorRoutes(fastify: FastifyInstance) {
  // Register new sensor
  // POST /api/sensor?deploy_key=xxx
  fastify.route({
    method: 'POST',
    url: '/sensor',
    schema: registerSensorSchema,
    handler: registerSensorHandler,
  });

  // List all sensors with optional filtering
  // GET /api/sensor?api_key=xxx&honeypot=cowrie&startDate=2024-01-01&endDate=2024-12-31
  fastify.route({
    method: 'GET',
    url: '/sensor',
    schema: getSensorsSchema,
    handler: getSensorsHandler,
  });

  // Get single sensor by UUID
  // GET /api/sensor/:uuid?api_key=xxx
  fastify.route({
    method: 'GET',
    url: '/sensor/:uuid',
    schema: getSensorSchema,
    handler: getSensorHandler,
  });

  // Update sensor details
  // PUT /api/sensor/:uuid?api_key=xxx
  fastify.route({
    method: 'PUT',
    url: '/sensor/:uuid',
    schema: updateSensorSchema,
    handler: updateSensorHandler,
  });

  // Delete sensor
  // DELETE /api/sensor/:uuid?api_key=xxx
  fastify.route({
    method: 'DELETE',
    url: '/sensor/:uuid',
    schema: deleteSensorSchema,
    handler: deleteSensorHandler,
  });

  // Sensor check-in/heartbeat
  // POST /api/sensor/:uuid/connect?deploy_key=xxx
  fastify.route({
    method: 'POST',
    url: '/sensor/:uuid/connect',
    schema: sensorConnectSchema,
    handler: sensorConnectHandler,
  });
}
