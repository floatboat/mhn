"use strict";
/**
 * Elasticsearch Forwarder - Export attack events to Elasticsearch
 * Supports ELK stack integration with Kibana visualization
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchForwarder = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Elasticsearch event forwarder
 */
class ElasticsearchForwarder {
    constructor(config) {
        this.buffer = [];
        this.maxBufferSize = 100;
        this.config = {
            index: 'mhn-attacks',
            verifySsl: true,
            timeout: 5000,
            ...config,
        };
        const url = `http${this.config.verifySsl ? 's' : ''}://${this.config.host}:${this.config.port}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.username && this.config.password) {
            const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }
        this.client = axios_1.default.create({
            baseURL: url,
            headers,
            timeout: this.config.timeout,
            httpsAgent: !this.config.verifySsl ? require('https').Agent({ rejectUnauthorized: false }) : undefined,
        });
        this.startFlushTimer();
    }
    /**
     * Send event to Elasticsearch
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
     * Get index name for given date
     */
    getIndexName(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${this.config.index}-${year}.${month}.${day}`;
    }
    /**
     * Flush buffered events to Elasticsearch
     */
    async flush() {
        if (this.buffer.length === 0)
            return;
        const events = this.buffer.splice(0, this.buffer.length);
        try {
            // Use bulk API for better performance
            const bulkPayload = events
                .map(event => {
                const indexName = this.getIndexName(new Date(event['@timestamp']));
                return (JSON.stringify({ index: { _index: indexName, _type: '_doc' } }) +
                    '\n' +
                    JSON.stringify(event) +
                    '\n');
            })
                .join('');
            await this.client.post('/_bulk', bulkPayload, {
                headers: { 'Content-Type': 'application/x-ndjson' },
            });
        }
        catch (error) {
            // Re-add events to buffer if send failed
            this.buffer.unshift(...events);
            throw new Error(`Failed to send events to Elasticsearch: ${String(error)}`);
        }
    }
    /**
     * Start periodic flush timer
     */
    startFlushTimer() {
        this.flushInterval = setInterval(() => {
            this.flush().catch(err => {
                console.error('Elasticsearch flush error:', err);
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
                console.error('Final Elasticsearch flush error:', err);
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
     * Test connection to Elasticsearch
     */
    async testConnection() {
        try {
            const response = await this.client.get('/');
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    /**
     * Create index template for automatic field mapping
     */
    async createIndexTemplate() {
        const template = {
            index_patterns: [`${this.config.index}-*`],
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
            },
            mappings: {
                properties: {
                    '@timestamp': { type: 'date' },
                    sourceIp: { type: 'ip' },
                    targetPort: { type: 'integer' },
                    protocol: { type: 'keyword' },
                    sensorUuid: { type: 'keyword' },
                    sensorName: { type: 'text' },
                    honeypotType: { type: 'keyword' },
                    payload: { type: 'text' },
                    country: { type: 'keyword' },
                    severity: { type: 'keyword' },
                    geoip: {
                        type: 'geo_point',
                        properties: {
                            location: { type: 'geo_point' },
                            country_code: { type: 'keyword' },
                        },
                    },
                },
            },
        };
        await this.client.put(`/_template/mhn-attacks-template`, template);
    }
}
exports.ElasticsearchForwarder = ElasticsearchForwarder;
