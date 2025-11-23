import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Authentication Flow
 * Tests critical authentication user journeys
 */

let page: Page;
const baseURL = process.env.API_BASE_URL || 'http://localhost';
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display login page', async () => {
    await page.goto(`${baseURL}/login`);

    // Check page title
    const heading = await page.locator('h1, h2').first();
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toContain('login');

    // Verify form fields exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    expect(await emailInput.isVisible()).toBe(true);
    expect(await passwordInput.isVisible()).toBe(true);
  });

  test('should handle login with invalid credentials', async () => {
    await page.goto(`${baseURL}/login`);

    // Fill form with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error message
    const errorMessage = page.locator('[class*="error"], [role="alert"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    const error = await errorMessage.textContent();
    expect(error?.toLowerCase()).toContain('invalid');
  });

  test('should login with valid credentials', async () => {
    // First create a test user via API
    const createUserResponse = await page.context().request.post(`${baseURL}/api/user`, {
      data: {
        email: testUser.email,
        name: `testuser-${Date.now()}`,
        password: testUser.password,
      },
    });

    if (!createUserResponse.ok()) {
      console.log('User may already exist, continuing with login test');
    }

    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Fill login form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('dashboard');

    // Verify we're logged in (check for user email or logout button)
    const logoutButton = page.locator('button:has-text("Logout")');
    expect(await logoutButton.isVisible()).toBe(true);
  });

  test('should logout successfully', async () => {
    // Login first
    const loginResponse = await page.context().request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'password123',
      },
    });

    const { accessToken } = await loginResponse.json();

    if (accessToken) {
      // Set token in storage
      await page.context().addCookies([
        {
          name: 'accessToken',
          value: accessToken,
          domain: new URL(baseURL).hostname,
          path: '/',
        },
      ]);
    }

    // Navigate to dashboard
    await page.goto(`${baseURL}/dashboard`);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout")');
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('should redirect unauthenticated users to login', async () => {
    // Try to access protected page without auth
    await page.goto(`${baseURL}/dashboard`);

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('should handle password reset flow', async () => {
    await page.goto(`${baseURL}/forgot-password`);

    // Check page elements
    const heading = await page.locator('h1, h2').first();
    expect(await heading.textContent()).toContain('password');

    // Fill email
    await page.fill('input[type="email"]', testUser.email);
    await page.click('button[type="submit"]');

    // Expect success message
    const successMessage = page.locator('[class*="success"], [role="status"]').first();
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  });
});
