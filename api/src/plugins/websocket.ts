/**
 * WebSocket Plugin - Real-time updates for dashboard and alerts
 * Provides live attack feed, sensor status updates, and alerts
 */

import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import * as dashboardService from '../services/dashboard.service';

/**
 * WebSocket event types
 */
export type WebSocketEventType = 'threat' | 'status' | 'alert' | 'metric' | 'heartbeat';

/**
 * WebSocket message format
 */
export interface WebSocketMessage {
  type: WebSocketEventType;
  timestamp: string;
  data: any;
}

/**
 * Connected client
 */
interface ConnectedClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  lastHeartbeat: Date;
}

/**
 * Initialize WebSocket server for real-time updates
 */
export async function websocketPlugin(fastify: FastifyInstance) {
  const clients = new Map<string, ConnectedClient>();
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
  function sendToClient(clientId: string, message: WebSocketMessage) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients or subscribed clients
   */
  function broadcast(message: WebSocketMessage, subscription?: string) {
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
        const message: WebSocketMessage = {
          type: 'threat',
          timestamp: new Date().toISOString(),
          data: threats,
        };
        broadcast(message, 'threats');
      } catch (error) {
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
        const message: WebSocketMessage = {
          type: 'metric',
          timestamp: new Date().toISOString(),
          data: { type: 'summary', ...summary },
        };
        broadcast(message, 'summary');
      } catch (error) {
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
          const message: WebSocketMessage = {
            type: 'alert',
            timestamp: new Date().toISOString(),
            data: alerts,
          };
          broadcast(message, 'alerts');
        }
      } catch (error) {
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
        const message: WebSocketMessage = {
          type: 'metric',
          timestamp: new Date().toISOString(),
          data: { type: 'trends', trends },
        };
        broadcast(message, 'trends');
      } catch (error) {
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
        } else if (client.ws.readyState === WebSocket.CLOSED) {
          clients.delete(clientId);
          fastify.log.info(`Client ${clientId} removed (connection closed)`);
        } else {
          // Send heartbeat
          const heartbeat: WebSocketMessage = {
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
    const client: ConnectedClient = {
      ws: socket,
      id: clientId,
      subscriptions: new Set(['threats', 'summary', 'alerts', 'trends']), // Default subscriptions
      lastHeartbeat: new Date(),
    };

    clients.set(clientId, client);
    fastify.log.info(`Client ${clientId} connected. Total clients: ${clients.size}`);

    // Handle incoming messages
    socket.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message);

        if (parsed.action === 'subscribe') {
          // Subscribe to specific updates
          if (parsed.channels && Array.isArray(parsed.channels)) {
            parsed.channels.forEach((channel: string) => {
              client.subscriptions.add(channel);
            });
            fastify.log.debug(`Client ${clientId} subscribed to ${parsed.channels.join(', ')}`);
          }
        } else if (parsed.action === 'unsubscribe') {
          // Unsubscribe from updates
          if (parsed.channels && Array.isArray(parsed.channels)) {
            parsed.channels.forEach((channel: string) => {
              client.subscriptions.delete(channel);
            });
            fastify.log.debug(`Client ${clientId} unsubscribed from ${parsed.channels.join(', ')}`);
          }
        } else if (parsed.action === 'ping') {
          // Handle ping/pong for keepalive
          client.lastHeartbeat = new Date();
          const response: WebSocketMessage = {
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
            data: { pong: true },
          };
          sendToClient(clientId, response);
        }
      } catch (error) {
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
    const welcome: WebSocketMessage = {
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
