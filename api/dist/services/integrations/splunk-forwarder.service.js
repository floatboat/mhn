"use strict";
/**
 * Splunk Forwarder - Export attack events to Splunk HTTP Event Collector
 * Sends events in JSON format via HTTP/HTTPS to Splunk
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplunkForwarder = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Splunk event forwarder
 */
class SplunkForwarder {
    constructor(config) {
        this.buffer = [];
        this.maxBufferSize = 100;
        this.config = {
            sourcetype: 'mhn:attack',
            source: 'mhn',
            verifySsl: true,
            timeout: 5000,
            ...config,
        };
        this.client = axios_1.default.create({
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
     * Flush buffered events to Splunk
     */
    async flush() {
        if (this.buffer.length === 0)
            return;
        const events = this.buffer.splice(0, this.buffer.length);
        try {
            const payload = events.map(e => ({ event: e })).join('\n');
            await this.client.post('', payload);
        }
        catch (error) {
            // Re-add events to buffer if send failed
            this.buffer.unshift(...events);
            throw new Error(`Failed to send events to Splunk: ${String(error)}`);
        }
    }
    /**
     * Start periodic flush timer
     */
    startFlushTimer() {
        this.flushInterval = setInterval(() => {
            this.flush().catch(err => {
                console.error('Splunk flush error:', err);
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
                console.error('Final Splunk flush error:', err);
            });
        }
    }
    /**
     * Get buffer size
     */
    getBufferSize() {
        return this.buffer.length;
    }
    /**
     * Test connection to Splunk
     */
    async testConnection() {
        try {
            await this.client.get('/');
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.SplunkForwarder = SplunkForwarder;
