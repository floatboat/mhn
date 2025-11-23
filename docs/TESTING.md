# Testing Guide

Complete guide to testing the MHN TypeScript implementation across all levels.

## Table of Contents

1. [Unit Tests](#unit-tests)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Frontend Tests](#frontend-tests)
5. [Load Testing](#load-testing)
6. [Running All Tests](#running-all-tests)

---

## Unit Tests

Unit tests for individual functions and services.

### Setup

Unit tests are already configured with Jest. No additional setup needed.

### Run Unit Tests

```bash
cd api
npm test
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

### Test Files

Located in `/api/test/` with matching service names:
- `auth.test.ts` - Authentication service tests
- `user.test.ts` - User service tests
- `sensor.test.ts` - Sensor management tests
- `attack.test.ts` - Attack data tests
- `rule.test.ts` - Rules management tests
- etc.

### Example Unit Test

```typescript
describe('UserService', () => {
  it('should create a user with hashed password', async () => {
    const user = await UserService.createUser('john', 'john@example.com', 'password');

    expect(user.email).toBe('john@example.com');
    expect(user.password).not.toBe('password'); // Should be hashed
  });
});
```

---

## Integration Tests

Integration tests that verify services work together and with databases.

### Already Integrated

The existing test suite includes integration tests:
- Database operations (using test PostgreSQL in docker-compose)
- API endpoint tests (full request/response cycle)
- Service interaction tests

### Running Integration Tests

```bash
cd api
# Ensure docker-compose is running with test database
docker-compose up -d postgres mongodb redis

# Run all tests (includes integration)
npm test

# Run only integration tests
npm test -- test/integration
```

### API Integration Tests

Test full HTTP endpoints with real database:

```bash
# This is how integration tests work
curl -X POST http://localhost:3000/api/user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## E2E Tests

End-to-end tests that simulate real user workflows using Playwright.

### Setup E2E Tests

```bash
cd api

# Install Playwright
npm install --save-dev @playwright/test

# Install browsers
npx playwright install

# Start the application (in another terminal)
npm run dev
```

### Run E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test test/e2e/auth.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode (interactive)
npx playwright test --debug

# Run specific test by name
npx playwright test -g "should login with valid credentials"

# View test report
npx playwright show-report
```

### E2E Test Files

Located in `/api/test/e2e/`:

- **auth.spec.ts** - Authentication flows
  - Login with valid/invalid credentials
  - Logout functionality
  - Password reset
  - Protected route access

- **sensors.spec.ts** - Sensor management
  - Sensor registration
  - List sensors with filters
  - Update sensor details
  - Check-in/heartbeat functionality

- **rules.spec.ts** - Rule management
  - Create/list/update/delete rules
  - Rule versioning
  - Export rules in Snort format
  - Search and filter rules

### E2E Test Example

```typescript
test('should login with valid credentials', async ({ page }) => {
  await page.goto('http://localhost/login');

  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
  expect(page.url()).toContain('dashboard');
});
```

### Debugging E2E Tests

```bash
# Run single test in debug mode
npx playwright test test/e2e/auth.spec.ts --debug

# Enable detailed logging
npx playwright test --debug --verbose

# Run with detailed trace
npx playwright test --trace on
```

---

## Frontend Tests

Component and page tests for Next.js frontend using Vitest.

### Setup Frontend Tests

```bash
cd web

# Install Vitest and testing libraries
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react

# Install testing utilities
npm install --save-dev @testing-library/user-event
```

### Run Frontend Tests

```bash
# Run all frontend tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- test/lib/auth-context.test.tsx
```

### Frontend Test Files

Located in `/web/test/`:

- **lib/auth-context.test.tsx** - Authentication context
  - Auth state management
  - Login/logout functions
  - User persistence
  - Error handling

### Frontend Test Example

```typescript
describe('AuthContext', () => {
  it('should load user from localStorage on mount', async () => {
    const testUser = { id: 1, email: 'test@example.com', name: 'Test User' };
    localStorage.setItem('user', JSON.stringify(testUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });
});
```

---

## Load Testing

Performance and stress testing using k6.

### Setup Load Testing

```bash
# Install k6
# macOS: brew install k6
# Linux: https://k6.io/docs/getting-started/installation/
# Windows: https://k6.io/docs/getting-started/installation/

# Verify installation
k6 version
```

### Run Load Tests

```bash
# Run load test with default settings
k6 run load-test.js

# Run with custom API URL
k6 run load-test.js --env BASE_URL=http://your-domain.com

# Run with custom credentials
k6 run load-test.js \
  --env BASE_URL=http://localhost \
  --env ADMIN_EMAIL=admin@example.com \
  --env ADMIN_PASSWORD=password123

# Run with custom VU count and duration
k6 run load-test.js --vus 100 --duration 5m

# Generate HTML report
k6 run load-test.js -o html=results.html
```

### Load Test Scenarios

The load-test.js includes tests for:

1. **Authentication** - Login endpoint performance
2. **Sensor Management** - List/filter sensors
3. **Attack Data** - Statistics and analysis queries
4. **Rules Management** - List/export rules
5. **Analytics** - Complex aggregation queries
6. **Health Checks** - Availability monitoring

### Load Test Interpretation

Results show:
- **http_req_duration** - How long requests take
  - Target: p(95) < 500ms, p(99) < 1000ms
- **http_req_failed** - Percentage of failed requests
  - Target: < 10% error rate
- **iterations** - Total number of test iterations completed
- **vus** - Virtual users (concurrent connections)

Example output:
```
     data_received..........: 15 MB   250 kB/s
     data_sent...............: 5 MB    83 kB/s
     http_req_duration.......: avg=245ms min=10ms  med=200ms max=5s    p(95)=400ms p(99)=900ms
     http_req_failed.........: 2.5%
     iterations.............: 5000    83/s
```

### Performance Tuning

If load test fails (high p95/p99 or error rate):

1. **Database queries too slow:**
   - Check for missing indexes
   - Review query plans: `EXPLAIN ANALYZE`
   - Consider caching with Redis

2. **API endpoints overloaded:**
   - Add rate limiting (already configured in Nginx)
   - Implement database connection pooling
   - Add horizontal scaling (load balancer)

3. **Memory issues:**
   - Check Node.js heap size: `--max-old-space-size=2048`
   - Profile with: `node --prof app.js`
   - Check for memory leaks

---

## Running All Tests

### Test Order (Recommended)

1. **Unit Tests** (fast, no dependencies)
2. **Integration Tests** (with test database)
3. **Frontend Tests** (isolated)
4. **E2E Tests** (full stack)
5. **Load Tests** (performance baseline)

### CI/CD Pipeline

The GitHub Actions workflow already runs unit tests:

```bash
# This runs on every PR
npm test
npm run prettier:check
```

### Local Test Suite

Run all tests locally:

```bash
# Terminal 1: Start services
docker-compose up -d postgres mongodb redis
cd api && npm run dev

# Terminal 2: Run all tests
cd api
npm test                              # Unit + integration
npx playwright test                   # E2E
cd ../web && npm run test             # Frontend

# Terminal 3: Load testing
k6 run load-test.js
```

### Test Coverage Goals

| Type | Current | Target | Priority |
|------|---------|--------|----------|
| Unit | 60% | >80% | HIGH |
| Integration | 70% | >85% | HIGH |
| E2E | 0% (new) | >80% of workflows | HIGH |
| Frontend | 0% (new) | >70% | MEDIUM |
| Load Testing | N/A | p95<500ms | MEDIUM |

---

## Best Practices

### Writing Tests

1. **Use descriptive names:**
   ```typescript
   // ✅ Good
   it('should create user with hashed password')

   // ❌ Bad
   it('creates user')
   ```

2. **Test one thing per test:**
   ```typescript
   // ✅ Good
   it('should validate email format')
   it('should reject duplicate emails')

   // ❌ Bad
   it('should validate email format and reject duplicates')
   ```

3. **Use data factories:**
   ```typescript
   // ✅ Good
   const user = createTestUser({ email: 'test@example.com' })

   // ❌ Bad
   const user = { id: 1, email: 'test@example.com', ... }
   ```

4. **Mock external dependencies:**
   ```typescript
   // ✅ Good
   vi.mock('@/services/email')

   // ❌ Bad
   // Actually sending emails in tests
   ```

### Test Database

- Use transaction rollback to clean up after tests
- Reset sequences/autoincrement
- Don't rely on test execution order
- Use database factories for test data

### E2E Test Tips

- Use `page.waitForURL()` instead of timeouts
- Test critical user paths only (not every button)
- Use test data cleanup
- Avoid hardcoded credentials (use env vars)

---

## Troubleshooting

### Tests timeout

```bash
# Increase timeout
npx playwright test --timeout 60000

# Or in playwright.config.ts:
timeout: 60000
```

### Database connection refused

```bash
# Ensure services are running
docker-compose ps

# Restart if needed
docker-compose restart postgres mongodb
```

### Playwright browser issues

```bash
# Reinstall browsers
npx playwright install --with-deps

# Run with specific browser
npx playwright test --project=chromium
```

### Load test errors

```bash
# Check API is accessible
curl http://localhost:3000/health

# Run with verbose logging
k6 run load-test.js --verbose
```

---

## Resources

- **Jest Docs:** https://jestjs.io/docs/getting-started
- **Playwright Docs:** https://playwright.dev/docs/intro
- **Vitest Docs:** https://vitest.dev/
- **k6 Docs:** https://k6.io/docs/
- **Testing Library:** https://testing-library.com/

---

**Last Updated:** 2025-11-23
