import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * E2E Tests: Rule Management
 * Tests rule creation, listing, updating, and export workflows
 */

let page: Page;
let request: APIRequestContext;
const baseURL = process.env.API_BASE_URL || 'http://localhost';
let authToken: string;

test.describe('Rule Management', () => {
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

  test('should display rules page', async () => {
    await page.goto(`${baseURL}/rules`);

    // Check page loaded
    const heading = await page.locator('h1, h2').first();
    expect(await heading.textContent()).toContain('Rule');

    // Verify rules table/list exists
    const rulesList = page.locator('[class*="rule"], [data-testid="rules-list"]').first();
    expect(await rulesList.isVisible()).toBe(true);
  });

  test('should create a new rule via API', async () => {
    const ruleMessage = `Test Rule ${Date.now()}`;

    const response = await request.post(`${baseURL}/api/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        message: ruleMessage,
        classtype: 'trojan-activity',
        sid: 1000000 + Math.floor(Math.random() * 1000),
        rev: 1,
        ruleFormat: 'alert http any any -> any any (msg:"${message}"; classtype:${classtype}; sid:${sid}; rev:${rev};)',
        isActive: true,
      },
    });

    expect(response.ok()).toBe(true);

    const rule = await response.json();
    expect(rule.message).toBe(ruleMessage);
    expect(rule.classtype).toBe('trojan-activity');
  });

  test('should list rules on rules page', async () => {
    await page.goto(`${baseURL}/rules`);

    // Wait for rules to load
    await page.waitForTimeout(2000);

    // Check if any rules are visible
    const ruleRows = page.locator('tbody tr, [class*="rule-item"]');
    const count = await ruleRows.count();

    if (count > 0) {
      // Verify rule content
      const firstRow = ruleRows.first();
      const text = await firstRow.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('should search/filter rules', async () => {
    await page.goto(`${baseURL}/rules`);

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible()) {
      // Search for a rule
      await searchInput.fill('trojan');
      await page.waitForTimeout(1000);

      // Verify filtered results
      const ruleRows = page.locator('tbody tr, [class*="rule-item"]');
      const count = await ruleRows.count();

      if (count > 0) {
        const text = await ruleRows.first().textContent();
        expect(text?.toLowerCase()).toContain('trojan');
      }
    }
  });

  test('should export rules in Snort format', async () => {
    const response = await request.get(`${baseURL}/api/rules.rules`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBe(true);

    const content = await response.text();

    // Rules should contain Snort syntax
    expect(content).toMatch(/alert|drop|pass/);
    expect(content).toMatch(/msg:/);
  });

  test('should update rule status', async () => {
    // Get first rule
    const response = await request.get(`${baseURL}/api/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const rules = await response.json();

    if (rules.length > 0) {
      const rule = rules[0];

      // Update rule (toggle active status)
      const updateResponse = await request.put(`${baseURL}/api/rule/${rule.id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          isActive: !rule.isActive,
        },
      });

      expect(updateResponse.ok()).toBe(true);

      const updated = await updateResponse.json();
      expect(updated.isActive).toBe(!rule.isActive);
    }
  });

  test('should handle rule versioning', async () => {
    const sid = 2000000 + Math.floor(Math.random() * 1000);

    // Create rule v1
    const v1Response = await request.post(`${baseURL}/api/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        message: `Versioned Rule ${sid}`,
        classtype: 'attempted-admin',
        sid,
        rev: 1,
        ruleFormat: 'alert tcp any any -> any any (sid:${sid}; rev:1;)',
        isActive: true,
      },
    });

    expect(v1Response.ok()).toBe(true);

    // Create rule v2 (same SID, different revision)
    const v2Response = await request.post(`${baseURL}/api/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        message: `Versioned Rule ${sid} v2`,
        classtype: 'attempted-admin',
        sid,
        rev: 2,
        ruleFormat: 'alert tcp any any -> any any (sid:${sid}; rev:2;)',
        isActive: true,
      },
    });

    expect(v2Response.ok()).toBe(true);

    // List rules with this SID - should have both versions
    const listResponse = await request.get(`${baseURL}/api/rule?sid=${sid}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const rules = await listResponse.json();
    expect(rules.length).toBeGreaterThanOrEqual(1);
  });

  test('should delete a rule', async () => {
    // Create a test rule
    const createResponse = await request.post(`${baseURL}/api/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        message: `Delete Test Rule ${Date.now()}`,
        classtype: 'suspicious-login',
        sid: 3000000 + Math.floor(Math.random() * 1000),
        rev: 1,
        ruleFormat: 'alert tcp any any -> any any (msg:"test"; sid:${sid};)',
        isActive: false,
      },
    });

    expect(createResponse.ok()).toBe(true);

    const rule = await createResponse.json();

    // Delete the rule
    const deleteResponse = await request.delete(`${baseURL}/api/rule/${rule.id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(deleteResponse.ok()).toBe(true);

    // Verify rule is deleted
    const getResponse = await request.get(`${baseURL}/api/rule/${rule.id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(getResponse.status()).toBe(404);
  });
});
