"use strict";
/**
 * WebSocket Plugin - Real-time updates for dashboard and alerts
 * Provides live attack feed, sensor status updates, and alerts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketPlugin = websocketPlugin;
const ws_1 = __importDefault(require("ws"));
const dashboardService = __importStar(require("../services/dashboard.service"));
/**
 * Initialize WebSocket server for real-time updates
 */
async function websocketPlugin(fastify) {
    const clients = new Map();
    let clientCounter = 0;
    // Periodic update intervals (in milliseconds)
    const UPDATE_INTERVALS = {
        threats: 5000, // Update every 5 seconds
        summary: 10000, // Update every 10 seconds
        alerts: 15000, // Update every 15 seconds
        trends: 30000, // Update every 30 seconds
    };
    /**
     * Send message to specific client
     */
    function sendToClient(clientId, message) {
        const client = clients.get(clientId);
        if (client && client.ws.readyState === ws_1.default.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast message to all connected clients or subscribed clients
     */
    function broadcast(message, subscription) {
        const now = new Date();
        clients.forEach((client, clientId) => {
            if (!subscription || client.subscriptions.has(subscription)) {
                sendToClient(clientId, message);
            }
        });
    }
    /**
     * Start periodic updates for threats
     */
    function startThreatsUpdates() {
        setInterval(async () => {
            try {
                const threats = await dashboardService.getActiveThreats(1, 50);
                const message = {
                    type: 'threat',
                    timestamp: new Date().toISOString(),
                    data: threats,
                };
                broadcast(message, 'threats');
            }
            catch (error) {
                fastify.log.error(error, 'Failed to get threats for WebSocket');
            }
        }, UPDATE_INTERVALS.threats);
    }
    /**
     * Start periodic updates for dashboard summary
     */
    function startSummaryUpdates() {
        setInterval(async () => {
            try {
                const summary = await dashboardService.getDashboardSummary();
                const message = {
                    type: 'metric',
                    timestamp: new Date().toISOString(),
                    data: { type: 'summary', ...summary },
                };
                broadcast(message, 'summary');
            }
            catch (error) {
                fastify.log.error(error, 'Failed to get summary for WebSocket');
            }
        }, UPDATE_INTERVALS.summary);
    }
    /**
     * Start periodic updates for alerts
     */
    function startAlertsUpdates() {
        setInterval(async () => {
            try {
                const alerts = await dashboardService.getAlerts();
                if (alerts.length > 0) {
                    const message = {
                        type: 'alert',
                        timestamp: new Date().toISOString(),
                        data: alerts,
                    };
                    broadcast(message, 'alerts');
                }
            }
            catch (error) {
                fastify.log.error(error, 'Failed to get alerts for WebSocket');
            }
        }, UPDATE_INTERVALS.alerts);
    }
    /**
     * Start periodic updates for trends
     */
    function startTrendsUpdates() {
        setInterval(async () => {
            try {
                const trends = await dashboardService.getAttackTrends(24);
                const message = {
                    type: 'metric',
                    timestamp: new Date().toISOString(),
                    data: { type: 'trends', trends },
                };
                broadcast(message, 'trends');
            }
            catch (error) {
                fastify.log.error(error, 'Failed to get trends for WebSocket');
            }
        }, UPDATE_INTERVALS.trends);
    }
    /**
     * Clean up disconnected clients
     */
    function startHeartbeatMonitor() {
        setInterval(() => {
            const now = new Date();
            const timeout = 60000; // 60 seconds
            clients.forEach((client, clientId) => {
                // Remove dead clients
                if (now.getTime() - client.lastHeartbeat.getTime() > timeout) {
                    clients.delete(clientId);
                    fastify.log.info(`Client ${clientId} removed (heartbeat timeout)`);
                }
                else if (client.ws.readyState === ws_1.default.CLOSED) {
                    clients.delete(clientId);
                    fastify.log.info(`Client ${clientId} removed (connection closed)`);
                }
                else {
                    // Send heartbeat
                    const heartbeat = {
                        type: 'heartbeat',
                        timestamp: now.toISOString(),
                        data: { clients: clients.size },
                    };
                    sendToClient(clientId, heartbeat);
                }
            });
        }, 30000); // Check every 30 seconds
    }
    /**
     * Register WebSocket handler
     */
    fastify.register(require('@fastify/websocket'));
    fastify.get('/ws', { websocket: true }, (socket, req) => {
        const clientId = `client-${++clientCounter}`;
        const client = {
            ws: socket,
            id: clientId,
            subscriptions: new Set(['threats', 'summary', 'alerts', 'trends']), // Default subscriptions
            lastHeartbeat: new Date(),
        };
        clients.set(clientId, client);
        fastify.log.info(`Client ${clientId} connected. Total clients: ${clients.size}`);
        // Handle incoming messages
        socket.on('message', (message) => {
            try {
                const parsed = JSON.parse(message);
                if (parsed.action === 'subscribe') {
                    // Subscribe to specific updates
                    if (parsed.channels && Array.isArray(parsed.channels)) {
                        parsed.channels.forEach((channel) => {
                            client.subscriptions.add(channel);
                        });
                        fastify.log.debug(`Client ${clientId} subscribed to ${parsed.channels.join(', ')}`);
                    }
                }
                else if (parsed.action === 'unsubscribe') {
                    // Unsubscribe from updates
                    if (parsed.channels && Array.isArray(parsed.channels)) {
                        parsed.channels.forEach((channel) => {
                            client.subscriptions.delete(channel);
                        });
                        fastify.log.debug(`Client ${clientId} unsubscribed from ${parsed.channels.join(', ')}`);
                    }
                }
                else if (parsed.action === 'ping') {
                    // Handle ping/pong for keepalive
                    client.lastHeartbeat = new Date();
                    const response = {
                        type: 'heartbeat',
                        timestamp: new Date().toISOString(),
                        data: { pong: true },
                    };
                    sendToClient(clientId, response);
                }
            }
            catch (error) {
                fastify.log.warn({ error }, `Invalid message from ${clientId}`);
            }
        });
        // Handle disconnect
        socket.on('close', () => {
            clients.delete(clientId);
            fastify.log.info(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
        });
        // Handle errors
        socket.on('error', (error) => {
            fastify.log.error({ error }, `WebSocket error for ${clientId}`);
            clients.delete(clientId);
        });
        // Send welcome message
        const welcome = {
            type: 'metric',
            timestamp: new Date().toISOString(),
            data: {
                type: 'welcome',
                clientId,
                subscriptions: Array.from(client.subscriptions),
                message: 'Connected to MHN real-time updates',
            },
        };
        sendToClient(clientId, welcome);
    });
    // Start periodic updates
    startThreatsUpdates();
    startSummaryUpdates();
    startAlertsUpdates();
    startTrendsUpdates();
    startHeartbeatMonitor();
    fastify.log.info('WebSocket plugin initialized');
}
