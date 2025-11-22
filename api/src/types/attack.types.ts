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
