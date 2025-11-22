// src/types/attack.types.ts

/**
 * Attack event as stored in MongoDB
 * Contains detailed attack data including payloads and metadata
 */
export interface AttackEventMongo {
  _id?: string; // MongoDB ObjectId
  sensorUuid: string; // Reference to sensor
  sourceIp: string; // Attacker IP address
  sourcePort?: number; // Attacker port (if available)
  destPort?: number; // Target port on honeypot
  protocol: string; // TCP, UDP, HTTP, SSH, etc.
  payload?: string; // Raw attack payload (if captured)
  timestamp: Date; // When attack occurred
  honeypotType: string; // dionaea, cowrie, conpot, etc.
  metadata?: Record<string, any>; // Honeypot-specific data
}

/**
 * Attack metadata as stored in PostgreSQL
 * Contains summary information and geolocation data
 */
export interface AttackRecord {
  id: number;
  sourceIp: string;
  protocol: string;
  port?: number;
  timestamp: Date;
  sensorId: number;
  mongoId?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for API (excludes sensitive data)
 * Used when returning attack data to clients
 */
export interface AttackResponse {
  id: number;
  sourceIp: string;
  protocol: string;
  port?: number;
  timestamp: string; // ISO 8601
  sensor: {
    uuid: string;
    name: string;
    honeypot: string;
  };
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Query filters for attack data
 * Used to filter and paginate attack listings
 */
export interface AttackQueryFilters {
  sensorId?: number; // Filter by specific sensor
  sourceIp?: string; // Filter by attacker IP
  protocol?: string; // Filter by protocol (TCP, UDP, etc.)
  startDate?: Date; // Filter attacks after this date
  endDate?: Date; // Filter attacks before this date
  limit?: number; // Pagination: max results to return
  offset?: number; // Pagination: number of results to skip
}

/**
 * Attack statistics response
 * Provides aggregated attack data for dashboards
 */
export interface AttackStatistics {
  totalAttacks: number; // Total number of attacks
  uniqueAttackers: number; // Number of unique source IPs
  topProtocols: Array<{ protocol: string; count: number }>; // Most common protocols
  topCountries: Array<{ country: string; count: number }>; // Countries with most attacks
  attacksByHoneypot: Array<{ honeypot: string; count: number }>; // Attacks per honeypot type
  timeRange: {
    start: Date; // Earliest attack in dataset
    end: Date; // Latest attack in dataset
  };
}

/**
 * Top attackers leaderboard entry
 */
export interface TopAttacker {
  sourceIp: string;
  attackCount: number;
  protocols: string[]; // Unique protocols used
  targetSensors: number; // Number of different sensors targeted
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Geographic statistics for heatmap visualization
 */
export interface GeoStatistics {
  country: string;
  countryCode: string;
  attackCount: number;
  uniqueAttackers: number;
  topCities: Array<{
    city: string;
    count: number;
    latitude?: number;
    longitude?: number;
  }>;
}

// JSON Schemas for request/response validation

/**
 * Schema for GET /api/attack
 * List attacks with filtering and pagination
 */
export const getAttacksSchema = {
  querystring: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start of date range (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End of date range (ISO 8601)',
      },
      sensorId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Filter by sensor ID',
      },
      sourceIp: {
        type: 'string',
        description: 'Filter by source IP address',
      },
      protocol: {
        type: 'string',
        enum: [
          'TCP',
          'UDP',
          'HTTP',
          'HTTPS',
          'SSH',
          'FTP',
          'SMTP',
          'DNS',
          'ICMP',
          'TELNET',
          'RDP',
          'SMB',
          'OTHER',
        ],
        description: 'Filter by protocol',
      },
      limit: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Results per page (default 20, max 1000)',
      },
      offset: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Pagination offset (default 0)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        attacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              sourceIp: { type: 'string' },
              protocol: { type: 'string' },
              port: { type: ['number', 'null'] },
              timestamp: { type: 'string' },
              sensor: {
                type: ['object', 'null'],
                properties: {
                  uuid: { type: 'string' },
                  name: { type: 'string' },
                  honeypot: { type: 'string' },
                },
              },
              location: {
                type: ['object', 'null'],
                properties: {
                  country: { type: ['string', 'null'] },
                  city: { type: ['string', 'null'] },
                  latitude: { type: ['number', 'null'] },
                  longitude: { type: ['number', 'null'] },
                },
              },
            },
          },
        },
        total: { type: 'number' },
        filtered: { type: 'number' },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/stats
 * Get attack statistics
 */
export const getAttackStatsSchema = {
  querystring: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional start date for filtering (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional end date for filtering (ISO 8601)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        totalAttacks: { type: 'number' },
        uniqueAttackers: { type: 'number' },
        topProtocols: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              protocol: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        topCountries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        attacksByHoneypot: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              honeypot: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        attacksBySensor: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sensorName: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/top-attackers
 * Get top attacker leaderboard
 */
export const getTopAttackersSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Number of top attackers to return (default 10, max 100)',
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional start date for filtering (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional end date for filtering (ISO 8601)',
      },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceIp: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          attackCount: { type: 'number' },
          protocols: {
            type: 'array',
            items: { type: 'string' },
          },
          sensorsHit: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/geo
 * Get geographic statistics for heatmap
 */
export const getGeoStatsSchema = {
  querystring: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional start date for filtering (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Optional end date for filtering (ISO 8601)',
      },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          country_code: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          attackCount: { type: 'number' },
          uniqueIps: { type: 'number' },
        },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/sensor/:sensorId
 * Get attacks for specific sensor
 */
export const getAttacksBySensorSchema = {
  params: {
    type: 'object',
    required: ['sensorId'],
    properties: {
      sensorId: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Sensor ID',
      },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Results per page (default 20, max 1000)',
      },
      offset: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Pagination offset (default 0)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        attacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              sourceIp: { type: 'string' },
              protocol: { type: 'string' },
              port: { type: ['number', 'null'] },
              timestamp: { type: 'string' },
              sensorId: { type: 'number' },
              mongoId: { type: ['string', 'null'] },
              location: {
                type: ['object', 'null'],
                properties: {
                  country: { type: ['string', 'null'] },
                  city: { type: ['string', 'null'] },
                  latitude: { type: ['number', 'null'] },
                  longitude: { type: ['number', 'null'] },
                },
              },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/search
 * Search attacks by source IP
 */
export const searchAttacksByIpSchema = {
  querystring: {
    type: 'object',
    required: ['ip'],
    properties: {
      ip: {
        type: 'string',
        description: 'Source IP address to search for (required)',
      },
      limit: {
        type: 'string',
        pattern: '^[0-9]+$',
        description: 'Maximum results to return (default 50, max 1000)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        attacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              sourceIp: { type: 'string' },
              protocol: { type: 'string' },
              port: { type: ['number', 'null'] },
              timestamp: { type: 'string' },
              sensorId: { type: 'number' },
              mongoId: { type: ['string', 'null'] },
              location: {
                type: ['object', 'null'],
                properties: {
                  country: { type: ['string', 'null'] },
                  city: { type: ['string', 'null'] },
                  latitude: { type: ['number', 'null'] },
                  longitude: { type: ['number', 'null'] },
                },
              },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
} as const;

/**
 * Schema for GET /api/attack/:id
 * Get detailed attack payload from MongoDB
 */
export const getAttackDetailSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9a-f]{24}$',
        description: 'MongoDB ObjectId (24 hex characters)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'Attack event document from MongoDB',
    },
  },
} as const;
