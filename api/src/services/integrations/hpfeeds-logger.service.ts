/**
 * HPFeeds Logger - Export attack events to HPFeeds broker
 * Allows MHN instance to contribute events back to HPFeeds community
 */

import * as net from 'net';

/**
 * HPFeeds event structure
 */
export interface HPFeedsEvent {
  timestamp: Date;
  sourceIp: string;
  targetPort?: number;
  protocol: string;
  sensorUuid: string;
  sensorName: string;
  honeypotType: string;
  payload?: string;
  country?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * HPFeeds logger configuration
 */
export interface HPFeedsLoggerConfig {
  brokerHost: string;
  brokerPort: number;
  channel: string;
  identifier: string; // Sensor UUID
  secret: string; // Random secret from credential generation
}

/**
 * HPFeeds logger for exporting events
 */
export class HPFeedsLogger {
  private config: HPFeedsLoggerConfig;
  private socket?: net.Socket;
  private connected = false;
  private buffer: HPFeedsEvent[] = [];
  private flushInterval?: NodeJS.Timer;

  constructor(config: HPFeedsLoggerConfig) {
    this.config = config;
  }

  /**
   * Connect to HPFeeds broker
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(
        {
          host: this.config.brokerHost,
          port: this.config.brokerPort,
        },
        () => {
          this.connected = true;
          this.authenticate();
          this.startFlushTimer();
          resolve();
        },
      );

      this.socket.on('error', (error) => {
        this.connected = false;
        reject(new Error(`Failed to connect to HPFeeds broker: ${error.message}`));
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  /**
   * Authenticate with HPFeeds broker
   */
  private authenticate(): void {
    if (!this.socket) return;

    // Send AUTH message: {identifier, secret}
    const authMessage = JSON.stringify({
      identifier: this.config.identifier,
      secret: this.config.secret,
    });

    this.socket.write(authMessage + '\n');
  }

  /**
   * Log an event to HPFeeds
   */
  async logEvent(event: HPFeedsEvent): Promise<void> {
    if (!this.connected) {
      // Buffer event if not connected
      this.buffer.push(event);
      return;
    }

    this.sendEvent(event);
  }

  /**
   * Log multiple events
   */
  async logEvents(events: HPFeedsEvent[]): Promise<void> {
    for (const event of events) {
      await this.logEvent(event);
    }
  }

  /**
   * Send event to broker
   */
  private sendEvent(event: HPFeedsEvent): void {
    if (!this.socket || !this.connected) return;

    const message = JSON.stringify({
      timestamp: event.timestamp.toISOString(),
      sourceIp: event.sourceIp,
      targetPort: event.targetPort,
      protocol: event.protocol,
      sensorUuid: event.sensorUuid,
      sensorName: event.sensorName,
      honeypotType: event.honeypotType,
      payload: event.payload,
      country: event.country,
      severity: event.severity,
    });

    this.socket.write(message + '\n');
  }

  /**
   * Flush buffered events
   */
  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0, this.buffer.length);
    for (const event of events) {
      this.sendEvent(event);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Disconnect from broker
   */
  async disconnect(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    if (this.socket) {
      this.socket.destroy();
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
