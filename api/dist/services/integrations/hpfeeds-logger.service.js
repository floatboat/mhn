"use strict";
/**
 * HPFeeds Logger - Export attack events to HPFeeds broker
 * Allows MHN instance to contribute events back to HPFeeds community
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
exports.HPFeedsLogger = void 0;
const net = __importStar(require("net"));
/**
 * HPFeeds logger for exporting events
 */
class HPFeedsLogger {
    constructor(config) {
        this.connected = false;
        this.buffer = [];
        this.config = config;
    }
    /**
     * Connect to HPFeeds broker
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection({
                host: this.config.brokerHost,
                port: this.config.brokerPort,
            }, () => {
                this.connected = true;
                this.authenticate();
                this.startFlushTimer();
                resolve();
            });
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
    authenticate() {
        if (!this.socket)
            return;
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
    async logEvent(event) {
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
    async logEvents(events) {
        for (const event of events) {
            await this.logEvent(event);
        }
    }
    /**
     * Send event to broker
     */
    sendEvent(event) {
        if (!this.socket || !this.connected)
            return;
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
    flushBuffer() {
        if (this.buffer.length === 0)
            return;
        const events = this.buffer.splice(0, this.buffer.length);
        for (const event of events) {
            this.sendEvent(event);
        }
    }
    /**
     * Start periodic flush timer
     */
    startFlushTimer() {
        this.flushInterval = setInterval(() => {
            this.flushBuffer();
        }, 5000); // Flush every 5 seconds
    }
    /**
     * Disconnect from broker
     */
    async disconnect() {
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
    isConnected() {
        return this.connected;
    }
    /**
     * Get buffer size
     */
    getBufferSize() {
        return this.buffer.length;
    }
}
exports.HPFeedsLogger = HPFeedsLogger;
