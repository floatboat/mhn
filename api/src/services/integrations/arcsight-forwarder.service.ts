/**
 * ArcSight Forwarder - Export attack events in CEF (Common Event Format) to ArcSight
 * Sends events via syslog protocol
 */

import * as dgram from 'dgram';

/**
 * CEF event for ArcSight
 */
export interface CEFEvent {
  severity: number; // 0-10 (higher = more severe)
  sourceIp: string;
  targetPort?: number;
  protocol: string;
  sensorName: string;
  honeypotType: string;
  timestamp: Date;
  additionalFields?: Record<string, string>;
}

/**
 * ArcSight forwarder configuration
 */
export interface ArcSightForwarderConfig {
  host: string;
  port: number;
  protocol: 'udp' | 'tcp'; // syslog protocol (default: udp)
  deviceVendor?: string; // Default: 'MHN'
  deviceProduct?: string; // Default: 'MHN'
  deviceVersion?: string; // Default: '1.0'
}

/**
 * ArcSight event forwarder
 */
export class ArcSightForwarder {
  private config: ArcSightForwarderConfig;
  private buffer: CEFEvent[] = [];
  private flushInterval?: NodeJS.Timer;
  private maxBufferSize = 50;

  constructor(config: ArcSightForwarderConfig) {
    this.config = {
      protocol: 'udp',
      deviceVendor: 'MHN',
      deviceProduct: 'MHN',
      deviceVersion: '1.0',
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Send event to ArcSight
   */
  async sendEvent(event: CEFEvent): Promise<void> {
    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Send multiple events
   */
  async sendEvents(events: CEFEvent[]): Promise<void> {
    for (const event of events) {
      this.buffer.push(event);
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Convert event to CEF format
   */
  private formatCEF(event: CEFEvent): string {
    const timestamp = Math.floor(event.timestamp.getTime() / 1000);

    // CEF header: CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|
    const cefHeader = `CEF:0|${this.config.deviceVendor}|${this.config.deviceProduct}|${this.config.deviceVersion}|${event.protocol.toUpperCase()}|Attack Detected|${event.severity}|`;

    // Extensions (key=value pairs)
    const extensions = [
      `src=${event.sourceIp}`,
      `dst=0.0.0.0`, // Target not always available
      `dpt=${event.targetPort || 0}`,
      `proto=${event.protocol}`,
      `cs1=${event.honeypotType}`,
      `cs1Label=HoneypotType`,
      `deviceExternalId=${event.sensorName}`,
      `rt=${timestamp}000`, // Timestamp in milliseconds
      ...(event.additionalFields
        ? Object.entries(event.additionalFields).map(([key, value]) => `${key}=${this.escapeCEF(value)}`)
        : []),
    ];

    return cefHeader + extensions.join(' ');
  }

  /**
   * Escape special characters in CEF
   */
  private escapeCEF(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/=/g, '\\=')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * Send syslog message
   */
  private sendSyslog(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const syslogMessage = `<14>MHN: ${message}`; // Priority 14 = user-level info

      if (this.config.protocol === 'udp') {
        const socket = dgram.createSocket('udp4');
        socket.send(syslogMessage, 0, syslogMessage.length, this.config.port, this.config.host, (err) => {
          socket.close();
          if (err) reject(err);
          else resolve();
        });
      } else {
        // TCP version would use net.Socket
        // For now, UDP is the standard syslog protocol
        reject(new Error('TCP syslog not yet implemented'));
      }
    });
  }

  /**
   * Flush buffered events
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0, this.buffer.length);

    try {
      for (const event of events) {
        const cefMessage = this.formatCEF(event);
        await this.sendSyslog(cefMessage);
      }
    } catch (error) {
      // Re-add events to buffer if send failed
      this.buffer.unshift(...events);
      throw new Error(`Failed to send events to ArcSight: ${String(error)}`);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('ArcSight flush error:', err);
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
        console.error('Final ArcSight flush error:', err);
      });
    }
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Map MHN severity to CEF severity (0-10)
 */
export function mapSeverityToCEF(severity?: 'low' | 'medium' | 'high' | 'critical'): number {
  switch (severity) {
    case 'critical':
      return 10;
    case 'high':
      return 7;
    case 'medium':
      return 5;
    case 'low':
      return 3;
    default:
      return 5;
  }
}
