# Known Issues & Technical Debt

## Critical Issues

### 1. Missing API Dockerfile
- **Status:** ❌ Blocking deployment
- **Impact:** Cannot containerize API service
- **Fix:** Create `/api/Dockerfile` with Node.js multi-stage build
- **Priority:** HIGH

### 2. Incomplete Docker Compose
- **Status:** ⚠️ Partially working
- **Issue:** Missing MongoDB, Redis, and API service definitions
- **Fix:** Update `docker-compose.yml` with all services
- **Priority:** HIGH

### 3. Frontend-API Communication
- **Status:** ⚠️ Basic implementation
- **Issue:** Environment variables not properly configured for prod
- **Fix:** Add `.env.production` template and deployment docs
- **Priority:** MEDIUM

---

## Code Quality Issues

### 1. Console.log Usage
- **Location:** Some handlers still use `console.log` instead of logger
- **Fix:** Replace with `fastify.log.info()` for structured logging
- **Priority:** LOW

### 2. Missing JSDoc Comments
- **Status:** ⚠️ Only critical functions documented
- **Fix:** Add JSDoc comments to all exported functions
- **Priority:** LOW

### 3. Demo Plugin Not Removed
- **Location:** `/api/src/plugins/support.ts`
- **Status:** Example code that should be removed
- **Fix:** Delete file and related tests
- **Priority:** LOW

### 4. No Environment Validation
- **Status:** ⚠️ Missing startup validation
- **Issue:** Required env vars not checked on startup
- **Fix:** Create `config.service.ts` with validation
- **Priority:** MEDIUM

### 5. No Request ID Correlation
- **Status:** ❌ Missing request ID tracking
- **Impact:** Difficult to trace requests across logs
- **Fix:** Add middleware to inject `x-request-id`
- **Priority:** MEDIUM

### 6. No API Rate Limiting
- **Status:** ❌ No DDoS protection
- **Impact:** API vulnerable to abuse
- **Fix:** Add `@fastify/rate-limit` plugin
- **Priority:** MEDIUM

---

## Testing Gaps

### 1. No E2E Tests
- **Status:** ❌ No end-to-end test suite
- **Impact:** Can't verify complete user workflows
- **Fix:** Create E2E tests with Playwright or Cypress
- **Priority:** HIGH (Phase 9)

### 2. No Frontend Tests
- **Status:** ❌ Web app has no test coverage
- **Impact:** UI changes can break functionality
- **Fix:** Add vitest + React Testing Library
- **Priority:** HIGH (Phase 9)

### 3. Missing Rule Fetch Tests
- **Status:** ⚠️ Basic unit tests exist, no integration tests
- **Issue:** Job scheduling and retry logic not fully tested
- **Fix:** Add integration tests for rule fetching background job
- **Priority:** MEDIUM

### 4. No Load Testing
- **Status:** ❌ Performance characteristics unknown
- **Impact:** Can't verify scalability claims
- **Fix:** Add k6 or Artillery load tests
- **Priority:** MEDIUM

---

## Infrastructure Issues

### 1. Redis Not Set Up
- **Status:** ❌ Missing for Bull job queues
- **Impact:** Jobs may be lost on restart
- **Fix:** Add Redis service to docker-compose
- **Priority:** MEDIUM

### 2. No Monitoring/Metrics
- **Status:** ❌ No observability
- **Impact:** Can't detect performance issues
- **Fix:** Add Prometheus + Grafana or datadog
- **Priority:** MEDIUM

### 3. No Backup Strategy
- **Status:** ❌ No data backup mechanism
- **Impact:** Data loss if database fails
- **Fix:** Implement PostgreSQL + MongoDB backup strategy
- **Priority:** HIGH

### 4. No Health Check Endpoints
- **Status:** ⚠️ Only root endpoint exists
- **Issue:** Load balancers can't verify service health
- **Fix:** Add `/health`, `/health/deep` endpoints
- **Priority:** MEDIUM

---

## Feature Limitations

### 1. No Real-time Updates
- **Status:** ❌ WebSocket not implemented
- **Impact:** Dashboard requires manual refresh
- **Fix:** Add Socket.io support (Phase 9)
- **Priority:** LOW

### 2. Limited Geolocation
- **Status:** ⚠️ Country-level only
- **Impact:** No city/ASN information
- **Fix:** Integrate MaxMind GeoIP2 database
- **Priority:** LOW

### 3. No Authentication 2FA
- **Status:** ❌ No two-factor authentication
- **Impact:** Accounts vulnerable if password compromised
- **Fix:** Add TOTP support (google-authenticator compatible)
- **Priority:** MEDIUM

### 4. No Deploy Script System
- **Status:** ❌ Not implemented
- **Impact:** Manual sensor deployment required
- **Fix:** Implement Phase 9 feature
- **Priority:** LOW

### 5. No Webhook Integrations
- **Status:** ❌ Not implemented
- **Impact:** Can't trigger external systems on alerts
- **Fix:** Add webhook delivery system
- **Priority:** LOW

---

## Documentation Issues

### 1. No OpenAPI/Swagger Spec
- **Status:** ❌ Missing API documentation
- **Impact:** Developers must read code to understand API
- **Fix:** Add `@fastify/swagger` plugin with full specs
- **Priority:** MEDIUM

### 2. No Database Migration Guide
- **Status:** ⚠️ Basic docs exist
- **Issue:** Disaster recovery procedures undocumented
- **Fix:** Add backup/restore procedures
- **Priority:** MEDIUM

### 3. No Performance Tuning Guide
- **Status:** ❌ Missing
- **Impact:** No guidance for production optimization
- **Fix:** Add tuning recommendations
- **Priority:** LOW

---

## Security Issues

### 1. CORS Not Configured
- **Status:** ⚠️ Default permissive CORS
- **Impact:** Any domain can call API
- **Fix:** Configure allowed origins in config
- **Priority:** MEDIUM

### 2. No CSRF Protection
- **Status:** ⚠️ Frontend could be vulnerable
- **Impact:** Form-based attacks possible
- **Fix:** Add CSRF token validation for state-changing requests
- **Priority:** MEDIUM

### 3. No SQL Injection Protection
- **Status:** ✅ Protected (Prisma parameterizes all queries)
- **Note:** No vulnerability, but document in security guide
- **Priority:** N/A

### 4. No Input Size Limits
- **Status:** ⚠️ No request size limits
- **Impact:** Large payloads could exhaust memory
- **Fix:** Add `bodyLimit` option to Fastify config
- **Priority:** MEDIUM

### 5. Secrets in Logs
- **Status:** ⚠️ Potential risk
- **Impact:** Sensitive data could be exposed
- **Fix:** Add log filtering to redact API keys, tokens
- **Priority:** HIGH

---

## Performance Issues

### 1. No Connection Pooling Config
- **Status:** ⚠️ Using defaults
- **Impact:** May hit connection limits under load
- **Fix:** Tune Prisma `connection_pool` settings
- **Priority:** LOW

### 2. No Query Optimization
- **Status:** ⚠️ Missing database indexes
- **Impact:** Slow queries as data grows
- **Fix:** Add indexes for frequently filtered fields
- **Priority:** MEDIUM

### 3. No Caching Layer
- **Status:** ❌ No Redis caching
- **Impact:** Repeated queries hit database
- **Fix:** Add Redis cache for frequently accessed data
- **Priority:** MEDIUM (Phase 9)

### 4. Large Test Suite Runtime
- **Status:** ⚠️ Tests take 30+ seconds
- **Impact:** Slow CI/CD feedback loop
- **Fix:** Parallelize tests, use test sharding
- **Priority:** LOW

---

## Browser Compatibility

### 1. Frontend Not Tested in Older Browsers
- **Status:** ⚠️ Uses modern JavaScript features
- **Impact:** May not work in IE11, older Safari
- **Fix:** Add browser compatibility testing with Browserstack
- **Priority:** LOW (unless supporting legacy browsers required)

---

## Known Workarounds

### 1. Rule Fetching Timeouts
- **Workaround:** Increase timeout in rule.service.ts
- **Root Cause:** Large rule files take time to download
- **Permanent Fix:** Implement streaming downloads (Phase 9)

### 2. MongoDB Connection Drops
- **Workaround:** Restart MongoDB container
- **Root Cause:** No connection pool management
- **Permanent Fix:** Configure Mongoose connection pool settings

### 3. Sensor Registration Failures
- **Workaround:** Verify deploy key is set in environment
- **Root Cause:** Deploy key not configured
- **Permanent Fix:** Add validation error message in API response

---

## Phase 9 Priority List

High-priority items for Phase 9 (Testing & Polish):

1. ✅ Add E2E tests (critical user flows)
2. ✅ Add frontend unit tests
3. ✅ Create API Dockerfile
4. ✅ Complete docker-compose.yml
5. ✅ Add environment validation
6. ✅ Implement health check endpoints
7. ✅ Add request ID correlation
8. ✅ Implement rate limiting
9. ✅ Add OpenAPI/Swagger docs
10. ✅ Improve error messages and logging

---

## Reporting Issues

To report a new issue:

1. Check this file to avoid duplicates
2. Create GitHub issue with reproduction steps
3. Include logs and error messages
4. Link to relevant code with `file:line_number` format
5. Suggest fix if possible

## Last Updated

**Date:** 2025-11-23
**Total Issues:** ~45 (Mostly LOW-MEDIUM priority)
**Critical Blockers:** 2 (Dockerfile, Docker Compose)
