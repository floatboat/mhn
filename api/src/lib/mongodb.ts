// src/lib/mongodb.ts

import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | undefined;
let db: Db | undefined;

/**
 * Connect to MongoDB and return database instance
 * @returns MongoDB database instance
 * @throws Error if connection fails
 */
export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  const uri =
    process.env.MONGODB_URI ||
    'mongodb://mongodb_user:mongodb_password@localhost:27017/mhn?authSource=admin';

  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  db = mongoClient.db('mhn');

  // Create collections and indexes
  await initializeCollections(db);

  return db;
}

/**
 * Get MongoDB database instance (must call connectMongoDB first)
 * @returns MongoDB database instance
 * @throws Error if not initialized
 */
export function getMongoDB(): Db {
  if (!db) {
    throw new Error('MongoDB not initialized. Call connectMongoDB() first.');
  }
  return db;
}

/**
 * Initialize MongoDB collections and indexes for efficient querying
 * @param database - MongoDB database instance
 */
async function initializeCollections(database: Db): Promise<void> {
  // Create attack_events collection if it doesn't exist
  const collections = await database.listCollections().toArray();
  const hasAttackEvents = collections.some(
    (col) => col.name === 'attack_events',
  );

  if (!hasAttackEvents) {
    await database.createCollection('attack_events');
  }

  // Create indexes for efficient querying
  const attackEvents = database.collection('attack_events');

  // Compound index for sensor and timestamp (most common query pattern)
  await attackEvents.createIndex({ sensorUuid: 1, timestamp: -1 });

  // Index for source IP lookups
  await attackEvents.createIndex({ sourceIp: 1 });

  // Index for timestamp-based queries (time range filtering)
  await attackEvents.createIndex({ timestamp: -1 });

  // Index for honeypot type filtering
  await attackEvents.createIndex({ honeypotType: 1 });
}

/**
 * Disconnect from MongoDB (for graceful shutdown)
 */
export async function disconnectMongoDB(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = undefined;
    db = undefined;
  }
}
