/**
 * Deploy Script Tests - Unit and Integration Tests
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('DeployScript Service & API', () => {
  let testUser: any;
  let adminUser: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'deployscript-test@example.com',
        name: 'deployscript_test_user',
        password: 'hashed_password',
        active: true,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: 'deployscript-admin@example.com',
        name: 'deployscript_admin_user',
        password: 'hashed_password',
        active: true,
      },
    });

    // Create API keys for authentication
    const testApiKey = await prisma.apiKey.create({
      data: {
        apiKey: 'test-deployscript-key-1234567890ab',
        userId: testUser.id,
      },
    });

    const adminApiKey = await prisma.apiKey.create({
      data: {
        apiKey: 'admin-deployscript-key-1234567890ab',
        userId: adminUser.id,
      },
    });

    authToken = testApiKey.apiKey;
    adminToken = adminApiKey.apiKey;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.deployScript.deleteMany({ where: { userId: testUser.id } });
    await prisma.deployScript.deleteMany({ where: { userId: adminUser.id } });
    await prisma.apiKey.deleteMany({ where: { userId: testUser.id } });
    await prisma.apiKey.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });
  });

  describe('POST /api/deployscript - Create Deploy Script', () => {
    it('should create a new deploy script', async () => {
      const response = await request(app.server)
        .post('/api/deployscript')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Ubuntu - Dionaea',
          script: '#!/bin/bash\necho "Installing Dionaea on {server_url}"',
          notes: 'Installs Dionaea honeypot on Ubuntu',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Ubuntu - Dionaea');
      expect(response.body.script).toContain('Installing Dionaea');
      expect(response.body.userId).toBe(testUser.id);
    });

    it('should reject missing name', async () => {
      const response = await request(app.server)
        .post('/api/deployscript')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          script: '#!/bin/bash\necho "test"',
        });

      expect(response.status).toBe(400);
    });

    it('should reject missing script content', async () => {
      const response = await request(app.server)
        .post('/api/deployscript')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Script',
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty name', async () => {
      const response = await request(app.server)
        .post('/api/deployscript')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          script: '#!/bin/bash\necho "test"',
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app.server).post('/api/deployscript').send({
        name: 'Unauthorized Script',
        script: '#!/bin/bash\necho "test"',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/deployscript - List Deploy Scripts', () => {
    beforeAll(async () => {
      // Create test scripts
      await prisma.deployScript.createMany({
        data: [
          {
            name: 'Ubuntu - Dionaea',
            script: '#!/bin/bash\necho "Install Dionaea"',
            notes: 'Ubuntu setup',
            userId: testUser.id,
          },
          {
            name: 'Debian - Cowrie',
            script: '#!/bin/bash\necho "Install Cowrie"',
            notes: 'Debian setup',
            userId: testUser.id,
          },
          {
            name: 'Admin Script',
            script: '#!/bin/bash\necho "Admin only"',
            notes: 'Admin notes',
            userId: adminUser.id,
          },
        ],
      });
    });

    it('should list all deploy scripts for authenticated user', async () => {
      const response = await request(app.server)
        .get('/api/deployscript')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should search scripts by name', async () => {
      const response = await request(app.server)
        .get('/api/deployscript?search=Dionaea')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].name).toContain('Dionaea');
    });

    it('should search scripts by notes', async () => {
      const response = await request(app.server)
        .get('/api/deployscript?search=Ubuntu')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should require authentication', async () => {
      const response = await request(app.server).get('/api/deployscript');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/deployscript/:id - Get Single Deploy Script', () => {
    let scriptId: number;

    beforeAll(async () => {
      const script = await prisma.deployScript.create({
        data: {
          name: 'Single Script Test',
          script: '#!/bin/bash\necho "Single test"',
          notes: 'Testing single get',
          userId: testUser.id,
        },
      });
      scriptId = script.id;
    });

    it('should get a single deploy script by ID', async () => {
      const response = await request(app.server)
        .get(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(scriptId);
      expect(response.body.name).toBe('Single Script Test');
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app.server)
        .get('/api/deployscript/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject invalid script ID', async () => {
      const response = await request(app.server)
        .get('/api/deployscript/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app.server).get(`/api/deployscript/${scriptId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/deployscript/:id/render - Render Script with Variables', () => {
    let scriptId: number;

    beforeAll(async () => {
      const script = await prisma.deployScript.create({
        data: {
          name: 'Template Script',
          script:
            '#!/bin/bash\necho "Server: {server_url}"\necho "Deploy Key: {deploy_key}"\necho "Sensor: {sensor_uuid}"',
          notes: 'Script with template variables',
          userId: testUser.id,
        },
      });
      scriptId = script.id;
    });

    it('should render script with variables', async () => {
      const response = await request(app.server)
        .post(`/api/deployscript/${scriptId}/render`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: {
            server_url: 'https://mhn.example.com',
            deploy_key: 'abc123def456',
            sensor_uuid: '550e8400-e29b-41d4-a716-446655440000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toContain('https://mhn.example.com');
      expect(response.body).toContain('abc123def456');
      expect(response.body).toContain('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return plain text content type', async () => {
      const response = await request(app.server)
        .post(`/api/deployscript/${scriptId}/render`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: {
            server_url: 'https://example.com',
            deploy_key: 'key123',
            sensor_uuid: 'uuid123',
          },
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should handle missing variables', async () => {
      const response = await request(app.server)
        .post(`/api/deployscript/${scriptId}/render`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toContain('{server_url}');
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app.server)
        .post('/api/deployscript/99999/render')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: { server_url: 'https://example.com' },
        });

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .post(`/api/deployscript/${scriptId}/render`)
        .send({
          variables: { server_url: 'https://example.com' },
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/deployscript/:id - Update Deploy Script', () => {
    let scriptId: number;

    beforeAll(async () => {
      const script = await prisma.deployScript.create({
        data: {
          name: 'Script to Update',
          script: '#!/bin/bash\necho "Original"',
          notes: 'Original notes',
          userId: testUser.id,
        },
      });
      scriptId = script.id;
    });

    it('should update script name', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Script Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Script Name');
    });

    it('should update script content', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          script: '#!/bin/bash\necho "Updated content"',
        });

      expect(response.status).toBe(200);
      expect(response.body.script).toContain('Updated content');
    });

    it('should update script notes', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Updated notes',
        });

      expect(response.status).toBe(200);
      expect(response.body.notes).toBe('Updated notes');
    });

    it('should update multiple fields', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Name',
          script: '#!/bin/bash\necho "New script"',
          notes: 'New notes',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.script).toContain('New script');
      expect(response.body.notes).toBe('New notes');
    });

    it('should reject empty name', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app.server)
        .put('/api/deployscript/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${scriptId}`)
        .send({
          name: 'Unauthorized Update',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/deployscript/:id - Delete Deploy Script', () => {
    let scriptId: number;

    beforeAll(async () => {
      const script = await prisma.deployScript.create({
        data: {
          name: 'Script to Delete',
          script: '#!/bin/bash\necho "Delete me"',
          notes: 'This will be deleted',
          userId: testUser.id,
        },
      });
      scriptId = script.id;
    });

    it('should delete a deploy script', async () => {
      const response = await request(app.server)
        .delete(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app.server)
        .get(`/api/deployscript/${scriptId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app.server)
        .delete('/api/deployscript/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject invalid script ID', async () => {
      const response = await request(app.server)
        .delete('/api/deployscript/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app.server).delete('/api/deployscript/1');

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization Tests', () => {
    let userScript: any;

    beforeAll(async () => {
      userScript = await prisma.deployScript.create({
        data: {
          name: 'User Private Script',
          script: '#!/bin/bash\necho "Private"',
          notes: 'User private script',
          userId: testUser.id,
        },
      });
    });

    it('should allow user to access their own scripts', async () => {
      const response = await request(app.server)
        .get(`/api/deployscript/${userScript.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow user to update their own scripts', async () => {
      const response = await request(app.server)
        .put(`/api/deployscript/${userScript.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated by owner',
        });

      expect(response.status).toBe(200);
    });

    it('should allow user to delete their own scripts', async () => {
      const response = await request(app.server)
        .delete(`/api/deployscript/${userScript.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });
  });
});
