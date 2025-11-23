import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

/**
 * E2E Tests: Sensor Management
 * Tests sensor registration, list, update, and deletion workflows
 */

let page: Page;
let request: APIRequestContext;
const baseURL = process.env.API_BASE_URL || 'http://localhost';
let authToken: string;

test.describe('Sensor Management', () => {
  test.beforeAll(async ({ playwright }) => {
    // Login to get auth token
    const context = await playwright.chromium.launchPersistentContext('');
    request = context.request;

    const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'password123',
      },
    });

    const loginData = await loginResponse.json();
    authToken = loginData.accessToken;
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Set auth token
    if (authToken) {
      await page.context().addCookies([
        {
          name: 'accessToken',
          value: authToken,
          domain: new URL(baseURL).hostname,
          path: '/',
        },
      ]);
    }
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display sensors page', async () => {
    await page.goto(`${baseURL}/sensors`);

    // Check page loaded
    const heading = await page.locator('h1, h2').first();
    expect(await heading.textContent()).toContain('Sensor');

    // Verify table or list exists
    const sensorList = page.locator('[class*="sensor"], [data-testid="sensor-list"]').first();
    expect(await sensorList.isVisible()).toBe(true);
  });

  test('should register a new sensor via API', async () => {
    const sensorUuid = uuidv4();
    const deployKey = process.env.DEPLOY_KEY || 'test-deploy-key';

    const response = await request.post(`${baseURL}/api/sensor`, {
      headers: {
        'X-Deploy-Key': deployKey,
      },
      data: {
        uuid: sensorUuid,
        name: 'Test Sensor',
        hostname: 'test-sensor.local',
        ip: '192.168.1.100',
        honeypot: 'dionaea',
      },
    });

    expect(response.ok()).toBe(true);

    const sensor = await response.json();
    expect(sensor.uuid).toBe(sensorUuid);
    expect(sensor.name).toBe('Test Sensor');
  });

  test('should list sensors on sensors page', async () => {
    await page.goto(`${baseURL}/sensors`);

    // Wait for sensors to load
    await page.waitForTimeout(2000);

    // Check if any sensor cards are visible
    const sensorCards = page.locator('[class*="card"], [class*="sensor-item"]');
    const count = await sensorCards.count();

    if (count > 0) {
      // Verify card content
      const firstCard = sensorCards.first();
      const text = await firstCard.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('should view sensor details', async () => {
    // Get list of sensors via API
    const response = await request.get(`${baseURL}/api/sensor`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const sensors = await response.json();

    if (sensors.length > 0) {
      const sensorUuid = sensors[0].uuid;

      // Navigate to sensors page
      await page.goto(`${baseURL}/sensors`);

      // Click on first sensor (if clickable)
      const firstSensorLink = page.locator(`[href*="sensor"], [data-sensor-id="${sensorUuid}"]`).first();

      if (await firstSensorLink.isVisible()) {
        await firstSensorLink.click();

        // Verify details page loaded
        const detailsHeading = page.locator('h1, h2').first();
        const heading = await detailsHeading.textContent();
        expect(heading).toBeTruthy();
      }
    }
  });

  test('should update sensor details', async () => {
    // Get first sensor
    const response = await request.get(`${baseURL}/api/sensor`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const sensors = await response.json();

    if (sensors.length > 0) {
      const sensor = sensors[0];

      // Update sensor
      const updateResponse = await request.put(`${baseURL}/api/sensor/${sensor.uuid}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: `${sensor.name}-updated`,
          hostname: 'updated-hostname.local',
        },
      });

      expect(updateResponse.ok()).toBe(true);

      const updated = await updateResponse.json();
      expect(updated.name).toContain('updated');
    }
  });

  test('should handle sensor check-in (heartbeat)', async () => {
    // Register a new sensor first
    const sensorUuid = uuidv4();
    const deployKey = process.env.DEPLOY_KEY || 'test-deploy-key';

    const registerResponse = await request.post(`${baseURL}/api/sensor`, {
      headers: {
        'X-Deploy-Key': deployKey,
      },
      data: {
        uuid: sensorUuid,
        name: 'Heartbeat Test Sensor',
        hostname: 'heartbeat.test',
        ip: '192.168.1.101',
        honeypot: 'cowrie',
      },
    });

    expect(registerResponse.ok()).toBe(true);

    // Send check-in request
    const checkInResponse = await request.post(`${baseURL}/api/sensor/${sensorUuid}/connect`, {
      headers: {
        'X-Deploy-Key': deployKey,
      },
    });

    expect(checkInResponse.ok()).toBe(true);

    // Verify sensor was updated
    const getResponse = await request.get(`${baseURL}/api/sensor/${sensorUuid}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(getResponse.ok()).toBe(true);

    const sensor = await getResponse.json();
    expect(sensor.lastSeen).toBeTruthy();
  });

  test('should filter sensors by honeypot type', async () => {
    await page.goto(`${baseURL}/sensors`);

    // Look for filter/dropdown
    const filterDropdown = page.locator('select, [role="combobox"]').first();

    if (await filterDropdown.isVisible()) {
      await filterDropdown.click();
      await page.locator('text=dionaea').first().click();

      // Verify filtered results
      await page.waitForTimeout(1000);
      const sensors = page.locator('[class*="sensor-card"], [class*="sensor-item"]');
      const count = await sensors.count();

      if (count > 0) {
        const text = await sensors.first().textContent();
        expect(text).toContain('dionaea');
      }
    }
  });
});
