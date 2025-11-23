/**
 * Splunk Forwarder - Export attack events to Splunk HTTP Event Collector
 * Sends events in JSON format via HTTP/HTTPS to Splunk
 */

import axios, { AxiosInstance } from 'axios';

/**
 * Splunk HEC event structure
 */
export interface SplunkEvent {
  timestamp: number; // Unix timestamp in seconds
  host: string;
  source: string;
  sourcetype: string;
  event: {
    sourceIp: string;
    targetPort?: number;
    protocol: string;
    sensorUuid: string;
    sensorName: string;
    honeypotType: string;
    payload?: string;
    country?: string;
    severity?: string;
  };
}

/**
 * Splunk forwarder configuration
 */
export interface SplunkForwarderConfig {
  hecUrl: string; // HTTP Event Collector URL (e.g., https://splunk.example.com:8088/services/collector)
  hecToken: string; // HEC authentication token
  sourcetype?: string; // Default sourcetype (default: 'mhn:attack')
  source?: string; // Default source (default: 'mhn')
  verifySsl?: boolean; // Verify SSL certificates (default: true)
  timeout?: number; // Request timeout in ms (default: 5000)
}

/**
 * Splunk event forwarder
 */
export class SplunkForwarder {
  private config: SplunkForwarderConfig;
  private client: AxiosInstance;
  private buffer: SplunkEvent[] = [];
  private flushInterval?: NodeJS.Timer;
  private maxBufferSize = 100;

  constructor(config: SplunkForwarderConfig) {
    this.config = {
      sourcetype: 'mhn:attack',
      source: 'mhn',
      verifySsl: true,
      timeout: 5000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.hecUrl,
      headers: {
        Authorization: `Splunk ${this.config.hecToken}`,
        'Content-Type': 'application/json',
      },
      timeout: this.config.timeout,
      httpsAgent: this.config.verifySsl ? undefined : require('https').Agent({ rejectUnauthorized: false }),
    });

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Send event to Splunk
   */
  async sendEvent(event: SplunkEvent): Promise<void> {
    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Send multiple events
   */
  async sendEvents(events: SplunkEvent[]): Promise<void> {
    for (const event of events) {
      this.buffer.push(event);
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered events to Splunk
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0, this.buffer.length);

    try {
      const payload = events.map(e => ({ event: e })).join('\n');

      await this.client.post('', payload);
    } catch (error) {
      // Re-add events to buffer if send failed
      this.buffer.unshift(...events);
      throw new Error(`Failed to send events to Splunk: ${String(error)}`);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('Splunk flush error:', err);
      });
    }, 10000); // Flush every 10 seconds
  }

  /**
   * Stop forwarder
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining events
    if (this.buffer.length > 0) {
      await this.flush().catch(err => {
        console.error('Final Splunk flush error:', err);
      });
    }
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Test connection to Splunk
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/');
      return true;
    } catch {
      return false;
    }
  }
}
