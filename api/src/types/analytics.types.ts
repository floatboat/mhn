/**
 * Type definitions and schemas for Analytics API
 */

export const AttackStatsSchema = {
  type: 'object',
  properties: {
    totalAttacks: { type: 'number', description: 'Total number of attacks' },
    uniqueAttackers: { type: 'number', description: 'Number of unique attacking IPs' },
    uniqueTargets: { type: 'number', description: 'Number of unique target ports' },
    avgAttacksPerHour: { type: 'number', description: 'Average attacks per hour' },
    avgAttacksPerDay: { type: 'number', description: 'Average attacks per day' },
  },
  required: ['totalAttacks', 'uniqueAttackers', 'uniqueTargets', 'avgAttacksPerHour', 'avgAttacksPerDay'],
};

export const TimeSeriesPointSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', description: 'Timestamp for this data point' },
    count: { type: 'number', description: 'Number of attacks in this period' },
    period: {
      type: 'string',
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
      description: 'Time period granularity',
    },
  },
  required: ['timestamp', 'count', 'period'],
};

export const TimeSeriesSchema = {
  type: 'array',
  items: TimeSeriesPointSchema,
};

export const ProtocolStatsSchema = {
  type: 'object',
  properties: {
    protocol: { type: 'string', description: 'Protocol name' },
    count: { type: 'number', description: 'Number of attacks using this protocol' },
    percentage: { type: 'number', description: 'Percentage of total attacks' },
  },
  required: ['protocol', 'count', 'percentage'],
};

export const ProtocolDistributionSchema = {
  type: 'array',
  items: ProtocolStatsSchema,
};

export const TopAttackerSchema = {
  type: 'object',
  properties: {
    sourceIp: { type: 'string', description: 'Attacking IP address' },
    attackCount: { type: 'number', description: 'Total attacks from this IP' },
    lastSeen: { type: 'string', format: 'date-time', description: 'Last attack timestamp' },
    uniqueTargets: { type: 'number', description: 'Number of unique target ports' },
  },
  required: ['sourceIp', 'attackCount', 'lastSeen', 'uniqueTargets'],
};

export const TopAttackersSchema = {
  type: 'array',
  items: TopAttackerSchema,
};

export const GeoHeatmapEntrySchema = {
  type: 'object',
  properties: {
    country: { type: 'string', description: 'Country name or code' },
    code: { type: ['string', 'null'], description: 'ISO country code' },
    attackCount: { type: 'number', description: 'Total attacks from this country' },
    uniqueIps: { type: 'number', description: 'Number of unique IPs from this country' },
    latitude: { type: ['number', 'null'], description: 'Country center latitude' },
    longitude: { type: ['number', 'null'], description: 'Country center longitude' },
  },
  required: ['country', 'attackCount', 'uniqueIps'],
};

export const GeoHeatmapSchema = {
  type: 'array',
  items: GeoHeatmapEntrySchema,
};

export const SensorStatsSchema = {
  type: 'object',
  properties: {
    sensorId: { type: 'number', description: 'Sensor ID' },
    sensorName: { type: 'string', description: 'Sensor name' },
    sensorUuid: { type: 'string', description: 'Sensor UUID' },
    totalAttacks: { type: 'number', description: 'Total attacks on this sensor' },
    uniqueAttackers: { type: 'number', description: 'Number of unique attacking IPs' },
    lastAttackTime: { type: ['string', 'null'], format: 'date-time', description: 'Last attack timestamp' },
    primaryProtocol: { type: 'string', description: 'Most common attack protocol' },
  },
  required: ['sensorId', 'sensorName', 'sensorUuid', 'totalAttacks', 'uniqueAttackers', 'primaryProtocol'],
};

export const SensorStatsListSchema = {
  type: 'array',
  items: SensorStatsSchema,
};

export const CountryStatsSchema = {
  type: 'object',
  properties: {
    country: { type: 'string', description: 'Country code or name' },
    count: { type: 'number', description: 'Number of attacks' },
  },
  required: ['country', 'count'],
};

export const CountryStatsListSchema = {
  type: 'array',
  items: CountryStatsSchema,
};

export const PortStatsSchema = {
  type: 'object',
  properties: {
    port: { type: 'number', description: 'Target port number' },
    count: { type: 'number', description: 'Number of attacks on this port' },
  },
  required: ['port', 'count'],
};

export const PortStatsListSchema = {
  type: 'array',
  items: PortStatsSchema,
};

export const HourlyFrequencySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      hour: { type: 'number', minimum: 0, maximum: 23, description: 'Hour of day (0-23)' },
      count: { type: 'number', description: 'Attacks in this hour' },
    },
    required: ['hour', 'count'],
  },
};
