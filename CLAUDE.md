# MHN TypeScript Rewrite

## Project Overview

Modern Honey Network (MHN) is being rewritten from Python/Flask to TypeScript/Node.js to modernize the codebase, improve type safety, and enhance maintainability.

**Current Branch:** You should be on a branch based off `origin/main` which contains the TypeScript implementation.

**Overall Progress:** ~45% complete (27 of 60+ legacy features implemented)

**Why TypeScript?**
- Strong type safety prevents entire classes of bugs
- Better IDE support and developer experience
- Modern async/await patterns
- Growing ecosystem with excellent libraries
- Easier to maintain and refactor

---

## ⚠️ Current Implementation Status

### ✅ Phase 1: Core Infrastructure (COMPLETE)

**What's Actually Working Right Now:**
- ✅ Basic Fastify application setup with auto-loading
- ✅ User creation API (POST /api/user)
- ✅ User listing API (GET /api/user) - returns usernames only
- ✅ bcrypt password hashing (10 salt rounds)
- ✅ JSON Schema request validation
- ✅ Prisma ORM with PostgreSQL integration
- ✅ Jest testing infrastructure with mocking
- ✅ GitHub Actions CI/CD pipeline (tests + formatting checks)
- ✅ Global error handling middleware
- ✅ Pino structured logging

**Lines of Code:** ~573 (including tests)

**Database Models Implemented:** 6 of 8 (User, Role, ApiKey, PasswdReset, Sensor, Attack)

**API Endpoints Implemented:** 31 of 40+ legacy endpoints

---

### ✅ Phase 2: Authentication & Authorization (COMPLETE)

**What's Implemented:**
- ✅ Complete User model with all fields (active, confirmedAt, createdAt, updatedAt)
- ✅ Role model with many-to-many relationship to Users
- ✅ ApiKey model for API authentication
- ✅ PasswdReset model for password recovery flow
- ✅ JWT token generation and validation (access + refresh tokens)
- ✅ Login/logout endpoints with token management
- ✅ Password reset flow (request + confirm)
- ✅ API key authentication
- ✅ Role-based access control (RBAC)
- ✅ Authentication guards/decorators (requireAuth, requireRole, requireApiKey, requireDeployKey)
- ✅ Token blacklist for logout functionality
- ✅ User management CRUD operations (GET, PUT, DELETE /api/user/:id)
- ✅ Role management API (CRUD + assignment/removal)
- ✅ API key management (create, list, delete)
- ✅ Comprehensive test coverage (102 tests passing)

**New Services:**
- [auth.service.ts](api/src/services/auth.service.ts) - Login, logout, token refresh
- [role.service.ts](api/src/services/role.service.ts) - Role management
- [apikey.service.ts](api/src/services/apikey.service.ts) - API key operations
- [password-reset.service.ts](api/src/services/password-reset.service.ts) - Password reset flow

**New Routes:**
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- POST /api/auth/refresh - Refresh access token
- GET /api/auth/me - Get current user
- POST /api/auth/reset-request - Request password reset
- POST /api/auth/reset-confirm - Confirm password reset
- GET /api/role - List all roles (admin only)
- POST /api/role - Create role (admin only)
- GET /api/role/:id - Get role details (admin only)
- DELETE /api/role/:id - Delete role (admin only)
- POST /api/role/:roleId/assign/:userId - Assign role to user (admin only)
- DELETE /api/role/:roleId/assign/:userId - Remove role from user (admin only)
- GET /api/apikey - List user's API keys (authenticated)
- POST /api/apikey - Create new API key (authenticated)
- DELETE /api/apikey/:id - Delete API key (authenticated)
- GET /api/user/:id - Get user details (authenticated)
- PUT /api/user/:id - Update user (authenticated, own account or admin)
- DELETE /api/user/:id - Delete user (admin only)

**Lines of Code:** ~3,500+ (including tests)

**Database Models Implemented:** 4 of 8 (User, Role, ApiKey, PasswdReset)

**API Endpoints Implemented:** 18 of 40+ legacy endpoints

**Test Coverage:** 102 tests passing, 4 skipped (unimplemented features)

---

### ✅ Phase 3: Sensor Management (COMPLETE)

**What's Implemented:**
- ✅ Sensor model with UUID, name, hostname, IP, honeypot type tracking
- ✅ Sensor registration API (POST /api/sensor)
- ✅ Sensor listing API (GET /api/sensor with filters)
- ✅ Single sensor retrieval (GET /api/sensor/:uuid)
- ✅ Sensor update API (PUT /api/sensor/:uuid)
- ✅ Sensor deletion API (DELETE /api/sensor/:uuid)
- ✅ Sensor check-in/heartbeat endpoint (POST /api/sensor/:uuid/connect)
- ✅ Deploy key authentication for sensor operations
- ✅ Comprehensive test coverage (24 integration tests + 19 service tests)
- ✅ Sensor service with 10+ business logic functions

**New Services:**
- [sensor.service.ts](api/src/services/sensor.service.ts) - Sensor management logic

**New Routes:**
- POST /api/sensor - Register new sensor (requires deploy_key)
- GET /api/sensor - List sensors with filters (requires api_key)
- GET /api/sensor/:uuid - Get sensor details (requires api_key)
- PUT /api/sensor/:uuid - Update sensor name/hostname (requires api_key)
- DELETE /api/sensor/:uuid - Delete sensor (requires api_key)
- POST /api/sensor/:uuid/connect - Sensor check-in/heartbeat (requires deploy_key)

**Lines of Code:** ~2,000+ (including tests)

**Database Models Implemented:** 5 of 8 (User, Role, ApiKey, PasswdReset, Sensor)

**API Endpoints Implemented:** 24 of 40+ legacy endpoints (6 new sensor endpoints)

**Test Coverage:** 151 tests passing, 4 skipped (175 total tests)

---

### ✅ Phase 4: Attack Data Collection (COMPLETE)

**What's Implemented:**
- ✅ MongoDB integration for attack data storage
- ✅ Attack model in PostgreSQL for metadata and tracking
- ✅ HPFeedsCredential model for sensor authentication
- ✅ HPFeeds service for broker communication and data collection
- ✅ HPFeeds credential management and channel routing
- ✅ Attack data service layer (15 functions)
- ✅ Attack data filtering and aggregation
- ✅ Attack statistics and analytics APIs
- ✅ Geographic heatmap data generation
- ✅ Attacker IP leaderboard
- ✅ Attack API endpoints (7 routes)
- ✅ Comprehensive test coverage (80 tests for Phase 4)

**New Services:**
- [attack.service.ts](api/src/services/attack.service.ts) - Attack data management and queries
- [hpfeeds.service.ts](api/src/services/hpfeeds.service.ts) - HPFeeds broker communication

**New Routes:**
- GET /api/attack - List attacks with filters (sensor, IP, protocol, time range)
- GET /api/attack/stats - Attack statistics (total, by protocol, by sensor)
- GET /api/attack/top-attackers - Attacker IP leaderboard with counts
- GET /api/attack/geo - Geographic heatmap data (attacks by country)
- GET /api/attack/sensor/:sensorId - Sensor-specific attack history
- GET /api/attack/search - Search attacks by IP address
- GET /api/attack/:id - Detailed attack data with full payload

**Database Models:**
- Attack model (PostgreSQL) - Attack metadata and references
- HPFeedsCredential model (PostgreSQL) - Sensor credentials for broker
- attack_events collection (MongoDB) - Detailed attack payloads and raw data

**Lines of Code:** ~2,500+ (including tests)

**Database Models Implemented:** 6 of 8 (User, Role, ApiKey, PasswdReset, Sensor, Attack)

**API Endpoints Implemented:** 31 of 40+ legacy endpoints (7 new attack endpoints)

**Test Coverage:** 307 tests passing, 4 skipped (311 total tests)

---

### ✅ Phase 5: Rules Management (COMPLETE - 60%)

**Overall Progress:** Phases 5A-5D complete (~60% of Phase 5), Phase 5E pending (automation)

**What's Implemented:**

#### Phase 5A: Database Schema ✅ COMPLETE
- ✅ Rule model with message, classtype, sid, rev, ruleFormat, isActive, notes
- ✅ Reference model for CVE numbers and rule references
- ✅ RuleSource model for rule download sources
- ✅ Proper relationships and cascade deletes
- ✅ Database migration: `20251122063610_add_rule_models`

#### Phase 5B: Rule Parsing & Validation ✅ COMPLETE
- ✅ Complete Snort/Suricata rule parser (405 lines)
- ✅ Rule renderer with template variable substitution
- ✅ Comprehensive validation suite (344 lines)
- ✅ Reference extraction from rule text
- ✅ 91 unit tests for parsing and validation

#### Phase 5C: Service Layer ✅ COMPLETE
- ✅ Rule service with 20 business logic functions
- ✅ createRule, getRuleById, listRules, updateRule, deleteRule
- ✅ Rule versioning (same SID, different rev)
- ✅ Reference management (add/remove)
- ✅ Search and filter rules by classtype, status
- ✅ Rule statistics and analytics
- ✅ RuleSource CRUD operations
- ✅ 55 unit tests for service layer

#### Phase 5D: Rule Management API ✅ COMPLETE
- ✅ 11 HTTP endpoints (6 rule, 5 rulesource)
- ✅ Request handlers with proper error handling
- ✅ Request/response schemas with JSON Schema validation
- ✅ Rule creation, reading, updating, deleting
- ✅ **Critical:** GET /api/rules.rules - Export active rules in Snort format (for sensors)
- ✅ RuleSource management endpoints
- ✅ 22 integration tests

**New Services:**
- [rule.service.ts](api/src/services/rule.service.ts) - Rule management (843 lines)

**New Handlers & Routes:**
- [rule.handler.ts](api/src/handlers/rule.handler.ts) - 11 request handlers (437 lines)
- [rule.route.ts](api/src/routes/api/rule.route.ts) - Route definitions (138 lines)

**New Type Definitions:**
- Extended [rule.types.ts](api/src/types/rule.types.ts) with request/response types and schemas

**API Endpoints (11 total):**
- POST /api/rule - Create rule (admin only)
- GET /api/rule - List rules with filters (api_key required)
- GET /api/rule/:id - Get single rule (api_key required)
- PUT /api/rule/:id - Update rule (admin only)
- DELETE /api/rule/:id - Delete rule (admin only)
- **GET /api/rules.rules** - Export active rules in Snort format (api_key required) - CRITICAL
- POST /api/rulesource - Create rule source (admin only)
- GET /api/rulesource - List rule sources (api_key required)
- GET /api/rulesource/:id - Get rule source (api_key required)
- PUT /api/rulesource/:id - Update rule source (admin only)
- DELETE /api/rulesource/:id - Delete rule source (admin only)

**Database Models Implemented:** 7 of 8 (User, Role, ApiKey, PasswdReset, Sensor, Attack, Rule)

**Lines of Code:** ~4,500+ (including tests)

**Test Coverage:** 517 tests passing, 4 skipped (521 total tests)

#### Phase 5E: Rule Fetching Automation ❌ NOT STARTED
- ❌ Background job system (node-cron or Bull)
- ❌ Scheduled rule fetching from RuleSource URIs
- ❌ Rule file parsing and bulk import
- ❌ Rule versioning and auto-disable of old revisions
- ❌ Error handling and retry logic

---

### 📊 Feature Parity with Legacy System

| Category | Legacy Features | Implemented | Progress |
|----------|----------------|-------------|----------|
| **Authentication** | 14 features | 14 | 100% |
| **Sensor Management** | 10 features | 6 | 60% |
| **Attack Data** | 11 features | 7 | 64% |
| **Rules Management** | 12 features | 7 | 58% |
| **Deploy Scripts** | 8 features | 0 | 0% |
| **Integrations** | 5 features | 0 | 0% |
| **TOTAL** | **60 features** | **34** | **57%** |

---

### 🚫 Critical Missing Features

**Database Models (2 of 8 remaining):**
- ❌ Rule - Snort/Suricata IDS rules
- ❌ Reference - Rule references (CVE, URLs)
- ❌ RuleSource - Rule download sources
- ❌ DeployScript - Deployment automation

**Core MHN Functionality:**
- ✅ ~~HPFeeds broker integration~~ (COMPLETE - Phase 4)
- ✅ ~~Attack data collection and storage~~ (COMPLETE - Phase 4)
- ✅ ~~MongoDB integration for attack data~~ (COMPLETE - Phase 4)
- ❌ Deploy script system
- ❌ Rules management and distribution
- ❌ Geolocation services (partially implemented - country-level)
- ❌ Real-time attack feed (WebSocket/SSE)

**External Integrations:**
- ❌ Splunk, ArcSight, ELK stack support
- ❌ Email notifications (password reset)

---

### 🐛 Known Issues & Technical Debt

**Critical Issues:**
1. **No authentication** - All endpoints are publicly accessible
2. **Missing Dockerfile** - docker-compose references non-existent /api/Dockerfile
3. **Incomplete User model** - Missing `active`, `confirmed_at`, `created_at`, `updated_at` fields
4. **No API documentation** - No OpenAPI/Swagger spec

**Code Quality Issues:**
1. **console.log usage** - [user.handler.ts](api/src/handlers/user.handler.ts) uses `console.log` instead of `fastify.log`
2. **Demo plugin not removed** - [support.ts](api/src/plugins/support.ts) is example code that should be removed
3. **No environment validation** - Environment variables not validated on startup
4. **Missing JSDoc comments** - Functions lack documentation
5. **No request IDs** - Missing correlation IDs for debugging
6. **No rate limiting** - API vulnerable to abuse

**Testing Gaps:**
- ✅ ~~No authentication tests~~ (COMPLETE - Phase 2)
- ✅ ~~No integration tests for sensors, attacks~~ (COMPLETE - Phases 3 & 4)
- ✅ ~~No integration tests for rules~~ (COMPLETE - Phase 5D, 22 tests)
- No integration tests for rule automation/fetching (Phase 5E)
- No end-to-end tests

**Infrastructure:**
- No Redis for caching/sessions
- ✅ ~~No MongoDB for attack data~~ (COMPLETE - Phase 4, docker-compose running)
- ✅ ~~No HPFeeds broker~~ (Service implemented in Phase 4)
- No monitoring/metrics

---

## Architecture

### Tech Stack

**Backend Framework:**
- **Fastify 5.0** - High-performance Node.js web framework
  - Chosen over Express for speed and built-in TypeScript support
  - Schema-based validation
  - Plugin architecture
  - Excellent performance benchmarks

**Database:**
- **PostgreSQL** - Primary relational database
  - Replaces SQLite for better scalability
  - ACID compliance
  - JSON support for flexible data
- **Prisma ORM 5.x** - Type-safe database client
  - Automatic TypeScript types from schema
  - Migration system
  - Query builder with excellent DX

**Authentication:**
- **bcrypt** - Password hashing ✅ (implemented)
- **JWT** - Token-based authentication ❌ (not implemented)
- **jsonwebtoken** - JWT library ❌ (not added)

**Testing:**
- **Jest** - Test framework ✅
- **ts-jest** - TypeScript support ✅
- **jest-mock-extended** - Advanced mocking ✅

**Development:**
- **TypeScript 5.7** - Static typing ✅
- **ts-node-dev** - Fast development reload ✅
- **Prettier** - Code formatting ✅
- **ESLint** - Code linting ❌ (not configured)

**Logging:**
- **Pino** - High-performance logging ✅
- **pino-pretty** - Development-friendly output ✅

**Deployment:**
- **Docker** - Containerization ⚠️ (Dockerfile missing)
- **docker-compose** - Multi-container orchestration ✅ (PostgreSQL + MongoDB)
- **GitHub Actions** - CI/CD pipeline ✅

**Data Storage:**
- **MongoDB** - Attack data storage ✅ (implemented in Phase 4)
- **Mongoose** - MongoDB ODM ✅ (implemented in Phase 4)

**Future Integrations (Not Started):**
- **Redis** - Caching and session storage
- **Bull** - Job queues (replace Celery)
- **Socket.io** - Real-time communication
- **node-cron** - Scheduled tasks

---

## Directory Structure

```
/mhn
├── api/                          # TypeScript backend
│   ├── src/
│   │   ├── app.ts                # Fastify app configuration ✅
│   │   ├── routes/
│   │   │   ├── index.ts          # Route registration ✅
│   │   │   └── api/
│   │   │       └── user.route.ts # User API routes ✅
│   │   ├── handlers/
│   │   │   ├── handlers.ts       # Basic handlers ✅
│   │   │   └── user.handler.ts   # User request handlers ✅
│   │   ├── services/
│   │   │   └── user.service.ts   # Business logic layer ✅
│   │   ├── types/
│   │   │   └── user.types.ts     # TypeScript types & schemas ✅
│   │   ├── lib/
│   │   │   └── prisma.ts         # Prisma client singleton ✅
│   │   └── plugins/
│   │       ├── errorHandler.ts   # Global error handling ✅
│   │       ├── sensible.ts       # HTTP helpers ✅
│   │       └── support.ts        # Demo plugin (remove) ⚠️
│   ├── test/
│   │   ├── __mocks__/
│   │   │   └── prisma.ts         # Prisma mock (empty) ⚠️
│   │   ├── index.test.ts         # Root tests ✅
│   │   ├── user.test.ts          # User API tests ✅
│   │   └── plugins/
│   │       └── support.test.ts   # Plugin tests (demo) ⚠️
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema (User only) ⚠️
│   │   └── migrations/           # Migration history ✅
│   ├── package.json              ✅
│   ├── tsconfig.json             ✅
│   ├── jest.config.ts            ✅
│   ├── Dockerfile                ❌ MISSING
│   └── README.md                 ✅
│
├── server/                       # Legacy Python Flask code (reference)
│   ├── CLAUDE_LEGACY.md          # Legacy documentation ✅
│   └── mhn/                      # See CLAUDE_LEGACY.md
│
├── scripts/                      # Legacy deployment scripts (to be ported)
│
├── docker-compose.yml            # Multi-service orchestration ⚠️ (incomplete)
├── CLAUDE.md                     # This file ✅
└── README.md                     # Project documentation ✅
```

---

## Database Schema

### Current Schema (Prisma)

**Implemented Models: 1 of 8**

```prisma
// ✅ IMPLEMENTED
model User {
  id       Int     @id @default(autoincrement())
  email    String  @unique
  name     String  @unique
  password String
}
```

**Issues with Current User Model:**
- ❌ Missing `active` Boolean field (user enabled/disabled)
- ❌ Missing `confirmedAt` DateTime field (email confirmation)
- ❌ Missing `createdAt` DateTime field (record creation timestamp)
- ❌ Missing `updatedAt` DateTime field (record update timestamp)
- ❌ Missing relations to Role, ApiKey, PasswdReset, DeployScript

---

### ❌ MISSING MODELS (7 of 8)

These models must be implemented for feature parity:

```prisma
// ❌ NOT IMPLEMENTED
model Role {
  id          Int      @id @default(autoincrement())
  name        String   @unique  // 'admin' or 'user'
  description String?
  users       User[]
}

// ❌ NOT IMPLEMENTED
model ApiKey {
  id        Int      @id @default(autoincrement())
  apiKey    String   @unique  // UUID without dashes (32 chars)
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  createdAt DateTime @default(now())
}

// ❌ NOT IMPLEMENTED
model PasswdReset {
  id        Int      @id @default(autoincrement())
  hashStr   String   @unique  // Reset token (40 chars)
  active    Boolean  @default(true)
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  createdAt DateTime @default(now())
}

// ❌ NOT IMPLEMENTED - CORE MHN FUNCTIONALITY
model Sensor {
  id          Int      @id @default(autoincrement())
  uuid        String   @unique  // UUID v1
  name        String
  hostname    String
  ip          String   // Auto-detected from request
  identifier  String   @unique  // Same as UUID (for HPFeeds)
  honeypot    String   // Type: dionaea, cowrie, conpot, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ❌ NOT IMPLEMENTED
model Rule {
  id         Int        @id @default(autoincrement())
  message    String
  classtype  String
  sid        Int        // Snort rule ID
  rev        Int        // Revision number
  ruleFormat String     // Rule template with placeholders
  isActive   Boolean    @default(true)
  notes      String?
  createdAt  DateTime   @default(now())
  references Reference[]

  @@unique([sid, rev])  // Only one version of each rule active
}

// ❌ NOT IMPLEMENTED
model Reference {
  id     Int    @id @default(autoincrement())
  text   String // CVE number, URL, etc.
  rule   Rule   @relation(fields: [ruleId], references: [id])
  ruleId Int
}

// ❌ NOT IMPLEMENTED
model RuleSource {
  id   Int     @id @default(autoincrement())
  name String
  uri  String  // URL to download rules from
  note String?
}

// ❌ NOT IMPLEMENTED
model DeployScript {
  id        Int      @id @default(autoincrement())
  name      String   // e.g., "Ubuntu - Dionaea"
  script    String   // Shell script content (large text)
  notes     String
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  createdAt DateTime @default(now())
}
```

---

## Design Patterns & Conventions

### Layered Architecture ✅

We follow a **3-tier architecture** for separation of concerns:

```
Routes → Handlers → Services → Database
  ↓         ↓          ↓          ↓
Define   Validate   Business   Data
paths    requests    logic     access
```

**Example flow for creating a user:**

1. **Route** ([api/user.route.ts:15](api/src/routes/api/user.route.ts#L15)) - Defines endpoint
   ```typescript
   fastify.post('/api/user', {
     schema: createUserSchema,  // Validation
     handler: createUserHandler  // Business logic
   })
   ```

2. **Handler** ([user.handler.ts:25](api/src/handlers/user.handler.ts#L25)) - Processes HTTP request/response
   ```typescript
   async function createUserHandler(request, reply) {
     const { name, email, password } = request.body
     const user = await createUser(name, email, password)
     reply.code(201).send(user)
   }
   ```

3. **Service** ([user.service.ts:23](api/src/services/user.service.ts#L23)) - Contains business logic
   ```typescript
   async function createUser(name, email, password) {
     // Check duplicates
     // Hash password
     // Create in database
     // Return user (exclude password)
   }
   ```

4. **Prisma** ([prisma.ts:7](api/src/lib/prisma.ts#L7)) - Database access
   ```typescript
   await prisma.user.create({ data: { name, email, password } })
   ```

### Error Handling ✅

**Custom Errors:**
```typescript
class UserExistsError extends Error {
  statusCode = 409
  constructor(message: string) {
    super(message)
    this.name = 'UserExistsError'
  }
}
```

**Error Handler Plugin** ([errorHandler.ts](api/src/plugins/errorHandler.ts)):
- Catches all errors globally
- Maps to appropriate HTTP status codes
- Provides user-friendly error messages
- Logs errors with Pino

### Schema Validation ✅

Use **JSON Schema** for Fastify validation:

```typescript
const createUserSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        pattern: '^[a-zA-Z0-9_]+$'
      },
      email: {
        type: 'string',
        format: 'email'
      },
      password: {
        type: 'string',
        minLength: 6
      }
    }
  }
}
```

### Testing Patterns ✅

**Mock External Dependencies:**
```typescript
import { mockDeep, mockReset } from 'jest-mock-extended'
import { PrismaClient } from '@prisma/client'

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>()
}))
```

**Test HTTP Endpoints:**
```typescript
const response = await app.inject({
  method: 'POST',
  url: '/api/user',
  payload: { name: 'test', email: 'test@example.com', password: 'password123' }
})
expect(response.statusCode).toBe(201)
```

---

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd mhn

# You should be on a branch based off origin/main with /api folder

# Install root dependencies (includes Prettier)
npm install

# Install API dependencies
cd api
npm install

# Start PostgreSQL (via Docker)
cd ..
docker-compose up -d postgres

# Run database migrations
cd api
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

### Common Development Tasks

#### Adding a New API Endpoint

1. **Define types** in `src/types/[feature].types.ts`
2. **Create service** in `src/services/[feature].service.ts`
3. **Create handler** in `src/handlers/[feature].handler.ts`
4. **Define route** in `src/routes/api/[feature].route.ts`
5. **Register route** in `src/routes/index.ts`
6. **Write tests** in `test/[feature].test.ts`

#### Adding a Database Model

```bash
# Edit prisma/schema.prisma
# Add your model

# Create migration
npx prisma migrate dev --name add_feature

# Generate TypeScript types
npx prisma generate
```

#### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Single file
npm test -- user.test.ts

# With coverage
npm test -- --coverage
```

#### Checking Code Style

```bash
# Format code
npm run prettier

# Check formatting (CI)
npm run prettier:check
```

### NPM Scripts (in /api)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm start` | Start production server (requires build) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run Jest tests |
| `npm run prettier` | Format code with Prettier |
| `npm run prettier:check` | Check formatting (CI) |
| `npm run clean` | Remove dist folder |

### Environment Variables

Create `.env` file in `/api`:

```env
# Database
DATABASE_URL="postgresql://api_user:randompassword@localhost:5432/agave"

# Server
PORT=3000
NODE_ENV=development

# Auth (not implemented yet)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
```

---

## Implementation Roadmap

### Phase 2: Authentication & Authorization (NEXT - BLOCKER)

**Priority:** CRITICAL - Blocks all other features
**Estimated Time:** 2-3 weeks

**Required Implementation:**

1. **Complete User Model:**
   ```prisma
   model User {
     id          Int       @id @default(autoincrement())
     email       String    @unique
     name        String    @unique
     password    String
     active      Boolean   @default(true)
     confirmedAt DateTime?
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt

     roles       Role[]
     apiKeys     ApiKey[]
     resetTokens PasswdReset[]
     deployScripts DeployScript[]
   }
   ```

2. **Add Supporting Models:**
   - Role (for RBAC)
   - ApiKey (for API authentication)
   - PasswdReset (for password recovery)

3. **JWT Service:**
   - Generate access tokens (short-lived)
   - Generate refresh tokens (long-lived)
   - Validate and decode tokens
   - Token blacklist/revocation

4. **Auth Endpoints:**
   - POST /api/auth/register (if public registration allowed)
   - POST /api/auth/login (email + password → JWT tokens)
   - POST /api/auth/logout (invalidate token)
   - POST /api/auth/refresh (refresh access token)
   - POST /api/auth/reset-request (request password reset)
   - POST /api/auth/reset-confirm (confirm password reset)

5. **Authentication Guards:**
   - `@RequireAuth` decorator (JWT validation)
   - `@RequireRole(role)` decorator (RBAC check)
   - `@RequireApiKey` decorator (API key validation)
   - Request context injection (add user to request)

6. **Comprehensive Tests:**
   - Unit tests for JWT service
   - Integration tests for all auth endpoints
   - Test all guards/decorators
   - Test token expiration and refresh
   - Test password reset flow

---

### Phase 3: Sensor Management (4-6 weeks)

**Prerequisites:** Phase 2 complete

**Implementation:**

1. **Sensor Model** (see schema above)

2. **Sensor API:**
   - POST /api/sensor (registration with deploy key auth)
   - GET /api/sensor (list with filters, requires API key)
   - GET /api/sensor/:uuid (single sensor)
   - PUT /api/sensor/:uuid (update)
   - DELETE /api/sensor/:uuid (delete + HPFeeds cleanup)
   - POST /api/sensor/:uuid/connect (check-in, update IP)

3. **HPFeeds Integration:**
   - Implement HPFeeds client library (Node.js)
   - Credential generation (UUID + random secret)
   - Channel assignment by honeypot type
   - Connection to broker
   - Auth key management

4. **Deploy Key Authentication:**
   - Environment variable configuration
   - Decorator for deploy key validation
   - Used only for sensor registration

---

### Phase 4: Attack Data Collection (6-8 weeks)

**Prerequisites:** Phase 3 complete

**Implementation:**

1. **MongoDB Integration:**
   - Add MongoDB to docker-compose
   - Implement Mongoose schemas for attack data
   - Replace Clio library with TypeScript implementation

2. **Attack Data Model:**
   - MongoDB collection for attack sessions
   - Geolocation fields (country, city, lat/lng)
   - Sensor reference (UUID)
   - Attacker IP, protocol, payload

3. **Attack Data API:**
   - GET /api/attack (list with filters: sensor, IP, time range, protocol)
   - GET /api/attack/:id (single attack)
   - GET /api/attack/stats (statistics)
   - GET /api/attack/top-attackers (leaderboard)
   - GET /api/attack/geo-stats (attack counts by country)

4. **HPFeeds Data Ingestion:**
   - Subscribe to all sensor channels
   - Parse attack events
   - Add geolocation (GeoIP2)
   - Store in MongoDB

5. **Real-time Features:**
   - WebSocket server for live attack feed
   - Server-sent events (SSE) alternative
   - Real-time dashboard updates

---

### Phase 5: Rules & Deploy Scripts (4-6 weeks)

**Prerequisites:** Phase 2 complete

**Implementation:**

1. **Rules Management:**
   - Implement Rule, Reference, RuleSource models
   - Build CRUD APIs
   - Snort rule parser (parse rule text → structured data)
   - Rule rendering (structured data → rule text)
   - Scheduled rule fetching (node-cron or Bull)
   - Rule export endpoint (GET /api/rules.rules)

2. **Deploy Scripts:**
   - Implement DeployScript model
   - Build CRUD APIs
   - Template variable replacement ({server_url}, {deploy_key}, etc.)
   - Load default scripts from /scripts folder
   - Script download endpoint with variables filled

---

### Phase 6: Data Visualization & Analytics (4-6 weeks)

**Prerequisites:** Phase 4 complete

**Implementation:**

- Attack statistics API
- Time-series aggregations
- Top targets/attackers
- Protocol distribution
- Sensor activity metrics
- Geographical heatmap data

---

### Phase 7: External Integrations (4-6 weeks)

**Prerequisites:** Phase 4 complete

**Implementation:**

- HPFeeds logger (generic event export)
- Splunk forwarder
- ArcSight integration
- ELK stack support
- JSON export API
- Email notifications (password reset, alerts)

---

### Phase 8: Frontend Application (8-12 weeks)

**Prerequisites:** Phases 2-5 complete

**Implementation:**

- Next.js/React setup
- Authentication UI
- Dashboard with real-time updates
- Sensor management interface
- Attack visualization (Honeymap)
- Rules management UI
- Deploy script management UI

---

### Total Estimated Timeline: 6-9 months to feature parity

---

## Code Quality Guidelines

### ✅ Good Practices (Keep Doing)

1. **Use TypeScript strictly** - No `any` types unless absolutely necessary
2. **Test everything** - Write tests before or alongside code
3. **Layer separation** - Keep routes, handlers, services separate
4. **Custom error classes** - Create specific error types with status codes
5. **Schema validation** - Use JSON Schema for all request validation
6. **Async/await** - No callbacks, promises only

### ⚠️ Issues to Fix

1. **Replace console.log:**
   ```typescript
   // ❌ Bad
   console.log('User created:', user)

   // ✅ Good
   request.log.info({ user }, 'User created')
   ```

2. **Add JSDoc comments:**
   ```typescript
   /**
    * Creates a new user with hashed password
    * @param name - Username (alphanumeric + underscore, 3+ chars)
    * @param email - Valid email address
    * @param password - Plain text password (6+ chars)
    * @returns User object without password
    * @throws UserExistsError if user already exists
    */
   async function createUser(name: string, email: string, password: string) {
     // ...
   }
   ```

3. **Create response DTOs:**
   ```typescript
   // Define what API returns (separate from DB model)
   interface UserResponse {
     id: number
     email: string
     name: string
     createdAt: string
   }
   ```

4. **Validate environment variables:**
   ```typescript
   // Create config service that validates on startup
   const config = {
     port: parseInt(process.env.PORT || '3000'),
     databaseUrl: requireEnv('DATABASE_URL'),
     jwtSecret: requireEnv('JWT_SECRET'),
   }
   ```

5. **Add OpenAPI documentation:**
   ```bash
   npm install @fastify/swagger @fastify/swagger-ui
   ```

---

## Testing Strategy

### Current Test Coverage ✅

**What's Tested:**
- ✅ User creation (happy path + duplicate handling)
- ✅ User listing
- ✅ Validation errors (missing fields, invalid formats)
- ✅ Password not returned in responses
- ✅ Error handling middleware
- ✅ Root routes

**Test Quality:** 9/10 for implemented features

### Testing Gaps ❌

**What's NOT Tested:**
- ❌ Authentication (not implemented)
- ❌ Authorization (not implemented)
- ❌ Sensors (not implemented)
- ❌ Attack data (not implemented)
- ❌ Rules (not implemented)
- ❌ Deploy scripts (not implemented)

### Testing Best Practices

1. **Test file structure:**
   ```
   test/
   ├── __mocks__/        # Shared mocks
   ├── unit/             # Unit tests (future)
   ├── integration/      # Integration tests
   └── e2e/              # End-to-end tests (future)
   ```

2. **Mock external dependencies:**
   - Always mock Prisma in unit tests
   - Mock external APIs (HPFeeds, GeoIP)
   - Use test database for integration tests

3. **Test coverage goals:**
   - Unit tests: >80% coverage
   - Integration tests: All API endpoints
   - E2E tests: Critical user flows

---

## Deployment

### Docker Status ⚠️

**Current State:**
- ✅ docker-compose.yml exists
- ✅ PostgreSQL service configured
- ❌ Dockerfile missing from /api directory
- ❌ MongoDB not in docker-compose
- ❌ Redis not in docker-compose
- ❌ HPFeeds broker not in docker-compose

**TODO:**
1. Create /api/Dockerfile
2. Add MongoDB service to docker-compose
3. Add Redis service to docker-compose
4. Add HPFeeds broker service to docker-compose

### Required Services for Full System

```yaml
services:
  postgres:     # ✅ Exists
  mongodb:      # ❌ Missing - for attack data
  redis:        # ❌ Missing - for caching/sessions
  hpfeeds:      # ❌ Missing - message broker
  api:          # ⚠️ Dockerfile missing
```

---

## Resources & Documentation

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Fastify Resources
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Fastify Best Practices](https://www.fastify.io/docs/latest/Guides/Style-Guide/)

### Prisma Resources
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

### Jest Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)

### Legacy System
- See [server/CLAUDE_LEGACY.md](server/CLAUDE_LEGACY.md) for Python/Flask implementation details
- **Essential reading** when implementing any feature to ensure parity

---

## Questions & Support

For questions about:
- **TypeScript implementation:** Check this file and Fastify/Prisma docs
- **Legacy Python features:** Check [server/CLAUDE_LEGACY.md](server/CLAUDE_LEGACY.md)
- **What exists vs. what's planned:** See "Current Implementation Status" section above
- **What to build next:** See "Implementation Roadmap" section above
- **Code patterns:** See "Design Patterns & Conventions" section above

---

## Quick Reference: What Actually Works

**Working Endpoints:**
```bash
# Health check
GET /                          # Returns { root: true }

# User management
POST /api/user                 # Create user (name, email, password)
GET /api/user                  # List usernames
GET /api/user/:id              # Get user details (authenticated)
PUT /api/user/:id              # Update user (authenticated)
DELETE /api/user/:id           # Delete user (admin only)

# Authentication
POST /api/auth/login           # User login (returns JWT tokens)
POST /api/auth/logout          # User logout
POST /api/auth/refresh         # Refresh access token
GET /api/auth/me               # Get current user
POST /api/auth/reset-request   # Request password reset
POST /api/auth/reset-confirm   # Confirm password reset

# Role management (admin only)
GET /api/role                  # List all roles
POST /api/role                 # Create role
GET /api/role/:id              # Get role details
DELETE /api/role/:id           # Delete role
POST /api/role/:roleId/assign/:userId    # Assign role to user
DELETE /api/role/:roleId/assign/:userId  # Remove role from user

# API key management (authenticated)
GET /api/apikey                # List user's API keys
POST /api/apikey               # Create new API key
DELETE /api/apikey/:id         # Delete API key

# Sensor management
POST /api/sensor               # Register new sensor (requires deploy_key)
GET /api/sensor                # List sensors with filters (requires api_key)
GET /api/sensor/:uuid          # Get sensor details (requires api_key)
PUT /api/sensor/:uuid          # Update sensor (requires api_key)
DELETE /api/sensor/:uuid       # Delete sensor (requires api_key)
POST /api/sensor/:uuid/connect # Sensor check-in/heartbeat (requires deploy_key)

# Attack data (NEW in Phase 4)
GET /api/attack                # List attacks with filters (sensor, IP, protocol, time)
GET /api/attack/stats          # Attack statistics (total, by protocol, by sensor)
GET /api/attack/top-attackers  # Attacker IP leaderboard
GET /api/attack/geo            # Geographic heatmap data
GET /api/attack/sensor/:sensorId # Sensor-specific attack history
GET /api/attack/search         # Search attacks by IP
GET /api/attack/:id            # Detailed attack data

# Test endpoints
GET /hello                     # Hello world
GET /error                     # Test error handling
```

**What DOESN'T Work Yet:**
- Rules management and distribution
- Deploy scripts system
- Real-time attack feed (WebSocket/SSE)
- External integrations (Splunk, ArcSight, ELK)
- Email notifications

---

**Last Updated:** 2025-11-22
**Current Status:** Phase 5D complete (~57%), Phase 5E (Rule Automation) next priority or Phase 6 (Frontend)
**Lines of Code:** ~9,500+ (including tests)
**Feature Parity:** 34 of 60+ legacy features (57%)
