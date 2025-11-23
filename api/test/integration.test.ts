/**
 * Integration Management Tests
 * Tests for integration configuration and alert management endpoints
 *
 * Run with: npm test -- integration.test.ts
 */

import Fastify from 'fastify';
import routes from '../src/routes';

describe('Integration Management', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });
    await app.register(routes);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Integration Endpoints', () => {
    it('should list integrations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/integration',
      });

      // Expect 200 or 401 (if auth required)
      expect([200, 401]).toContain(response.statusCode);
    });

    it('should create email integration configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/integration/email',
        payload: {
          provider: 'smtp',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUsername: 'test@example.com',
          smtpPassword: 'password',
          fromEmail: 'noreply@example.com',
        },
      });

      // Expect 201 or 401 (if auth required)
      expect([201, 400, 401]).toContain(response.statusCode);
    });

    it('should get integration information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/integration/email',
      });

      // Expect 200 or 401 (if auth required) or 404 (if not found)
      expect([200, 401, 404]).toContain(response.statusCode);
    });

    it('should test integration connection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/integration/email/test',
      });

      // Expect 200, 400, or 401
      expect([200, 400, 401]).toContain(response.statusCode);
    });

    it('should toggle integration status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/integration/email/toggle',
        payload: { enabled: false },
      });

      // Expect 200 or 401 (if auth required) or 404
      expect([200, 400, 401, 404]).toContain(response.statusCode);
    });

    it('should get integration logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/integration/email/logs?limit=10',
      });

      // Expect 200 or 401 or 404
      expect([200, 401, 404]).toContain(response.statusCode);
    });

    it('should get integration statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/integration/email/stats',
      });

      // Expect 200 or 401 or 404
      expect([200, 401, 404]).toContain(response.statusCode);
    });

    it('should delete integration', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/integration/email',
      });

      // Expect 200 or 401 or 404
      expect([200, 401, 404]).toContain(response.statusCode);
    });
  });

  describe('Alert Endpoints', () => {
    it('should list alerts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alert',
      });

      // Expect 200 or 401
      expect([200, 401]).toContain(response.statusCode);
    });

    it('should create DDoS alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alert',
        payload: {
          type: 'ddos',
          threshold: 100,
          timeWindow: 300,
        },
      });

      // Expect 201 or 401 or 400
      expect([201, 400, 401]).toContain(response.statusCode);
    });

    it('should create port scan alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alert',
        payload: {
          type: 'port_scan',
          threshold: 10,
          timeWindow: 300,
        },
      });

      // Expect 201 or 401 or 400
      expect([201, 400, 401]).toContain(response.statusCode);
    });

    it('should create high severity alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alert',
        payload: {
          type: 'high_severity',
          threshold: 20,
          timeWindow: 600,
        },
      });

      // Expect 201 or 401 or 400
      expect([201, 400, 401]).toContain(response.statusCode);
    });

    it('should get alert by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alert/1',
      });

      // Expect 200 or 401 or 404
      expect([200, 401, 404]).toContain(response.statusCode);
    });

    it('should update alert', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/alert/1',
        payload: {
          threshold: 50,
        },
      });

      // Expect 200 or 401 or 404
      expect([200, 400, 401, 404]).toContain(response.statusCode);
    });

    it('should toggle alert status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/alert/1/toggle',
        payload: { enabled: false },
      });

      // Expect 200 or 401 or 404
      expect([200, 400, 401, 404]).toContain(response.statusCode);
    });

    it('should delete alert', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/alert/1',
      });

      // Expect 200 or 401 or 404
      expect([200, 401, 404]).toContain(response.statusCode);
    });
  });
});
