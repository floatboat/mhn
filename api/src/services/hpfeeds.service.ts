/**
 * HPFeeds Service - Handles connection to HPFeeds broker
 * Manages sensor credentials and message publishing/subscription
 *
 * HPFeeds is a lightweight publish-subscribe protocol for exchanging honeypot data.
 * This service provides an event-driven interface for broker communication.
 */

import { EventEmitter } from 'events';

/**
 * HPFeeds credential structure
 */
export interface HPFeedsCredentials {
  uuid: string; // Sensor UUID
  secret: string; // Random 40-char hex secret
  channel: string; // Channel to subscribe to (e.g., "dionaea.capture")
}

/**
 * HPFeeds message from broker
 */
export interface HPFeedsMessage {
  timestamp: number;
  sensorUuid: string;
  channel: string;
  payload: Record<string, any>; // JSON attack data
}

/**
 * HPFeeds connection configuration
 */
export interface HPFeedsConfig {
  brokerHost: string;
  brokerPort: number;
}

/**
 * Service for HPFeeds broker communication
 *
 * This service manages:
 * - Broker connection lifecycle
 * - Sensor credential management
 * - Message publishing and subscription
 * - Event emission for attack data
 *
 * @example
 * ```typescript
 * const service = getHPFeedsService();
 * await service.connect();
 *
 * // Register sensor credentials
 * const creds = await service.registerSensor('uuid-v1', 'secret-40-chars', 'dionaea');
 *
 * // Subscribe to sensor's channel
 * await service.subscribe('uuid-v1');
 *
 * // Listen for attack events
 * service.on('attack_published', (message) => {
 *   console.log('New attack:', message);
 * });
 * ```
 */
export class HPFeedsService extends EventEmitter {
  private brokerHost: string;
  private brokerPort: number;
  private connected: boolean = false;
  private credentials: Map<string, HPFeedsCredentials> = new Map();

  /**
   * Creates a new HPFeeds service instance
   * @param brokerHost - HPFeeds broker hostname (defaults to HPFEEDS_BROKER_HOST env var or 'localhost')
   * @param brokerPort - HPFeeds broker port (defaults to HPFEEDS_BROKER_PORT env var or 20000)
   */
  constructor(brokerHost?: string, brokerPort?: number) {
    super();
    this.brokerHost =
      brokerHost || process.env.HPFEEDS_BROKER_HOST || 'localhost';
    this.brokerPort =
      brokerPort || parseInt(process.env.HPFEEDS_BROKER_PORT || '20000');
  }

  /**
   * Connect to HPFeeds broker
   *
   * TODO: Implement actual HPFeeds protocol connection
   * Currently simulates connection for development.
   * Future implementation should use HPFeeds wire protocol or compatible library.
   *
   * @throws Error if connection fails
   */
  async connect(): Promise<void> {
    // TODO: Implement actual HPFeeds protocol connection
    // For now, simulate connection
    this.connected = true;
    this.emit('connected', { host: this.brokerHost, port: this.brokerPort });
  }

  /**
   * Disconnect from HPFeeds broker
   * Cleans up active connections and subscriptions
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * Check if currently connected to broker
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register sensor credentials with broker
   *
   * In a real implementation, this would authenticate with the broker using sensor credentials.
   * The broker would then allow publishing to the sensor's assigned channel.
   *
   * @param sensorUuid - Sensor UUID (UUID v1)
   * @param secret - Random 40-character hex secret
   * @param honeypotType - Type of honeypot (dionaea, cowrie, conpot, etc.)
   * @returns HPFeeds credentials object
   */
  async registerSensor(
    sensorUuid: string,
    secret: string,
    honeypotType: string,
  ): Promise<HPFeedsCredentials> {
    const channel = this.getChannelByHoneypot(honeypotType);

    const creds: HPFeedsCredentials = {
      uuid: sensorUuid,
      secret,
      channel,
    };

    this.credentials.set(sensorUuid, creds);

    // Would authenticate with broker here in real implementation
    if (this.connected) {
      this.emit('sensor_registered', { sensorUuid, channel });
    }

    return creds;
  }

  /**
   * Get HPFeeds channel for honeypot type
   *
   * Each honeypot type publishes to a specific channel:
   * - dionaea -> dionaea.capture (malware capture events)
   * - cowrie -> cowrie.sessions (SSH/Telnet sessions)
   * - conpot -> conpot.events (ICS/SCADA events)
   * - etc.
   *
   * @param honeypotType - Type of honeypot
   * @returns HPFeeds channel name
   * @private
   */
  private getChannelByHoneypot(honeypotType: string): string {
    const channels: Record<string, string> = {
      dionaea: 'dionaea.capture',
      cowrie: 'cowrie.sessions',
      conpot: 'conpot.events',
      glastopf: 'glastopf.events',
      kippo: 'kippo.sessions',
      wordpot: 'wordpot.events',
      shockpot: 'shockpot.events',
      p0f: 'p0f.events',
    };

    return channels[honeypotType] || `${honeypotType}.events`;
  }

  /**
   * Subscribe to sensor's channel
   *
   * After subscription, the broker will forward all messages on this channel.
   * The service will emit 'attack_published' events for incoming messages.
   *
   * @param sensorUuid - Sensor UUID to subscribe to
   * @throws Error if no credentials found for sensor
   */
  async subscribe(sensorUuid: string): Promise<void> {
    const creds = this.credentials.get(sensorUuid);

    if (!creds) {
      throw new Error(`No credentials found for sensor ${sensorUuid}`);
    }

    // Would subscribe to broker channel here in real implementation
    this.emit('subscribed', { sensorUuid, channel: creds.channel });
  }

  /**
   * Publish attack message to broker
   *
   * Sensors publish attack events to their assigned channel.
   * The broker forwards these to all subscribers.
   *
   * @param sensorUuid - Sensor UUID publishing the message
   * @param payload - Attack data (honeypot-specific format)
   * @throws Error if no credentials found or not connected
   *
   * @example
   * ```typescript
   * await service.publishAttack('sensor-uuid', {
   *   src_ip: '192.168.1.100',
   *   dst_port: 22,
   *   protocol: 'ssh',
   *   timestamp: Date.now()
   * });
   * ```
   */
  async publishAttack(
    sensorUuid: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const creds = this.credentials.get(sensorUuid);

    if (!creds) {
      throw new Error(`No credentials found for sensor ${sensorUuid}`);
    }

    if (!this.connected) {
      throw new Error('Not connected to HPFeeds broker');
    }

    const message: HPFeedsMessage = {
      timestamp: Date.now(),
      sensorUuid,
      channel: creds.channel,
      payload,
    };

    // Would publish to broker here in real implementation
    this.emit('attack_published', message);
  }

  /**
   * Get all registered sensor credentials
   * @returns Array of all HPFeeds credentials
   */
  getAllCredentials(): HPFeedsCredentials[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Get credentials for specific sensor
   * @param sensorUuid - Sensor UUID
   * @returns HPFeeds credentials or undefined if not found
   */
  getCredentials(sensorUuid: string): HPFeedsCredentials | undefined {
    return this.credentials.get(sensorUuid);
  }

  /**
   * Unregister sensor (e.g., when deleted)
   *
   * Removes sensor credentials and unsubscribes from channel.
   * Should be called when a sensor is deleted from the system.
   *
   * @param sensorUuid - Sensor UUID to unregister
   */
  async unregisterSensor(sensorUuid: string): Promise<void> {
    this.credentials.delete(sensorUuid);

    if (this.connected) {
      this.emit('sensor_unregistered', { sensorUuid });
    }
  }

  /**
   * Get current broker configuration
   * @returns Broker host and port
   */
  getConfig(): HPFeedsConfig {
    return {
      brokerHost: this.brokerHost,
      brokerPort: this.brokerPort,
    };
  }

  /**
   * Get count of registered sensors
   * @returns Number of sensors with registered credentials
   */
  getRegisteredSensorCount(): number {
    return this.credentials.size;
  }
}

// Singleton instance
let hpfeedsService: HPFeedsService;

/**
 * Get or create HPFeeds service instance (singleton)
 *
 * This ensures only one HPFeeds service exists in the application,
 * preventing multiple broker connections.
 *
 * @returns HPFeeds service instance
 */
export function getHPFeedsService(): HPFeedsService {
  if (!hpfeedsService) {
    hpfeedsService = new HPFeedsService();
  }
  return hpfeedsService;
}

/**
 * Initialize HPFeeds service and connect to broker
 *
 * Should be called during application startup.
 * Creates singleton service and establishes broker connection.
 *
 * @returns Connected HPFeeds service instance
 * @throws Error if connection fails
 *
 * @example
 * ```typescript
 * // In app.ts startup
 * await initializeHPFeeds();
 * ```
 */
export async function initializeHPFeeds(): Promise<HPFeedsService> {
  const service = getHPFeedsService();

  if (!service.isConnected()) {
    await service.connect();
  }

  return service;
}
