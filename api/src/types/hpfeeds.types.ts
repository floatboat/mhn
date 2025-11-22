/**
 * HPFeeds Type Definitions and JSON Schemas
 *
 * This file contains TypeScript interfaces and JSON schemas for HPFeeds-related operations.
 */

/**
 * HPFeeds credential generation request
 */
export interface GenerateCredentialsRequest {
  sensorUuid: string;
  honeypotType: string;
}

/**
 * HPFeeds credential response
 * Returned when credentials are generated for a sensor
 */
export interface HPFeedsCredentialResponse {
  uuid: string; // Same as sensorUuid
  secret: string; // Random 40-char hex
  channel: string; // HPFeeds channel to use
  brokerHost: string; // Broker hostname
  brokerPort: number; // Broker port
}

/**
 * HPFeeds broker status
 * Provides information about broker connection and registered sensors
 */
export interface HPFeedsStatus {
  connected: boolean;
  brokerHost: string;
  brokerPort: number;
  registeredSensors: number;
  lastUpdate: Date;
}

/**
 * JSON Schema for generating HPFeeds credentials
 * POST /api/hpfeeds/credentials
 */
export const generateCredentialsSchema = {
  body: {
    type: 'object',
    required: ['sensorUuid', 'honeypotType'],
    properties: {
      sensorUuid: {
        type: 'string',
        pattern:
          '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
        description: 'UUID v1 of the sensor',
      },
      honeypotType: {
        type: 'string',
        enum: [
          'dionaea',
          'cowrie',
          'conpot',
          'glastopf',
          'kippo',
          'wordpot',
          'shockpot',
          'p0f',
        ],
        description: 'Type of honeypot',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        uuid: { type: 'string' },
        secret: { type: 'string' },
        channel: { type: 'string' },
        brokerHost: { type: 'string' },
        brokerPort: { type: 'number' },
      },
    },
  },
} as const;

/**
 * JSON Schema for HPFeeds status endpoint
 * GET /api/hpfeeds/status
 */
export const hpfeedsStatusSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        brokerHost: { type: 'string' },
        brokerPort: { type: 'number' },
        registeredSensors: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

/**
 * JSON Schema for listing all HPFeeds credentials
 * GET /api/hpfeeds/credentials
 */
export const listCredentialsSchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          uuid: { type: 'string' },
          secret: { type: 'string' },
          channel: { type: 'string' },
        },
      },
    },
  },
} as const;

/**
 * JSON Schema for getting credentials by sensor UUID
 * GET /api/hpfeeds/credentials/:uuid
 */
export const getCredentialsByUuidSchema = {
  params: {
    type: 'object',
    required: ['uuid'],
    properties: {
      uuid: {
        type: 'string',
        pattern:
          '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
        description: 'Sensor UUID v1',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        uuid: { type: 'string' },
        secret: { type: 'string' },
        channel: { type: 'string' },
        brokerHost: { type: 'string' },
        brokerPort: { type: 'number' },
      },
    },
  },
} as const;

/**
 * JSON Schema for deleting credentials
 * DELETE /api/hpfeeds/credentials/:uuid
 */
export const deleteCredentialsSchema = {
  params: {
    type: 'object',
    required: ['uuid'],
    properties: {
      uuid: {
        type: 'string',
        pattern:
          '^[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
        description: 'Sensor UUID v1',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
} as const;
