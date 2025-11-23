"use strict";
/**
 * ArcSight Forwarder - Export attack events in CEF (Common Event Format) to ArcSight
 * Sends events via syslog protocol
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcSightForwarder = void 0;
exports.mapSeverityToCEF = mapSeverityToCEF;
const dgram = __importStar(require("dgram"));
/**
 * ArcSight event forwarder
 */
class ArcSightForwarder {
    constructor(config) {
        this.buffer = [];
        this.maxBufferSize = 50;
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
    async sendEvent(event) {
        this.buffer.push(event);
        // Flush if buffer is full
        if (this.buffer.length >= this.maxBufferSize) {
            await this.flush();
        }
    }
    /**
     * Send multiple events
     */
    async sendEvents(events) {
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
    formatCEF(event) {
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
    escapeCEF(value) {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/=/g, '\\=')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }
    /**
     * Send syslog message
     */
    sendSyslog(message) {
        return new Promise((resolve, reject) => {
            const syslogMessage = `<14>MHN: ${message}`; // Priority 14 = user-level info
            if (this.config.protocol === 'udp') {
                const socket = dgram.createSocket('udp4');
                socket.send(syslogMessage, 0, syslogMessage.length, this.config.port, this.config.host, (err) => {
                    socket.close();
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            else {
                // TCP version would use net.Socket
                // For now, UDP is the standard syslog protocol
                reject(new Error('TCP syslog not yet implemented'));
            }
        });
    }
    /**
     * Flush buffered events
     */
    async flush() {
        if (this.buffer.length === 0)
            return;
        const events = this.buffer.splice(0, this.buffer.length);
        try {
            for (const event of events) {
                const cefMessage = this.formatCEF(event);
                await this.sendSyslog(cefMessage);
            }
        }
        catch (error) {
            // Re-add events to buffer if send failed
            this.buffer.unshift(...events);
            throw new Error(`Failed to send events to ArcSight: ${String(error)}`);
        }
    }
    /**
     * Start periodic flush timer
     */
    startFlushTimer() {
        this.flushInterval = setInterval(() => {
            this.flush().catch(err => {
                console.error('ArcSight flush error:', err);
            });
        }, 10000); // Flush every 10 seconds
    }
    /**
     * Stop forwarder
     */
    async stop() {
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
    getBufferSize() {
        return this.buffer.length;
    }
}
exports.ArcSightForwarder = ArcSightForwarder;
/**
 * Map MHN severity to CEF severity (0-10)
 */
function mapSeverityToCEF(severity) {
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
