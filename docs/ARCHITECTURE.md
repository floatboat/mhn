# Architecture Overview

## Tech Stack

### Backend Framework
- **Fastify 5.0** - High-performance Node.js web framework
  - Chosen over Express for speed and built-in TypeScript support
  - Schema-based validation
  - Plugin architecture
  - Excellent performance benchmarks

### Database
- **PostgreSQL** - Primary relational database
  - Replaces SQLite for better scalability
  - ACID compliance
  - JSON support for flexible data
- **Prisma ORM 5.x** - Type-safe database client
  - Automatic TypeScript types from schema
  - Migration system
  - Query builder with excellent DX

### Authentication
- **bcrypt** - Password hashing ✅
- **JWT** - Token-based authentication ✅
- **jsonwebtoken** - JWT library ✅

### Data Storage
- **MongoDB** - Attack data storage ✅
- **Mongoose** - MongoDB ODM ✅

### Testing
- **Jest** - Test framework ✅
- **ts-jest** - TypeScript support ✅
- **jest-mock-extended** - Advanced mocking ✅

### Development
- **TypeScript 5.7** - Static typing ✅
- **ts-node-dev** - Fast development reload ✅
- **Prettier** - Code formatting ✅
- **ESLint** - Code linting ✅

### Logging
- **Pino** - High-performance logging ✅
- **pino-pretty** - Development-friendly output ✅

### Deployment
- **Docker** - Containerization ⚠️ (API Dockerfile missing)
- **docker-compose** - Multi-container orchestration ✅
- **GitHub Actions** - CI/CD pipeline ✅

### Integrations
- **node-cron** - Scheduled tasks ✅
- **Bull** - Job queues ✅
- **Socket.io** - Real-time communication (future)
- **Redis** - Caching and session storage (future)

---

## Directory Structure

```
/mhn
├── api/                          # TypeScript backend
│   ├── src/
│   │   ├── app.ts                # Fastify app configuration
│   │   ├── routes/
│   │   │   ├── index.ts          # Route registration
│   │   │   └── api/              # Feature routes
│   │   ├── handlers/             # Request handlers
│   │   ├── services/             # Business logic
│   │   ├── types/                # TypeScript types & schemas
│   │   ├── lib/                  # Utilities & client singletons
│   │   └── plugins/              # Fastify plugins
│   ├── test/                     # Test files
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── migrations/           # Migration history
│   └── package.json
│
├── web/                          # Next.js frontend
│   ├── app/                      # Route pages
│   ├── components/               # React components
│   ├── lib/                      # Utilities & hooks
│   └── package.json
│
├── server/                       # Legacy Python code (reference)
├── scripts/                      # Deployment scripts (legacy)
├── docker-compose.yml            # Multi-service orchestration
├── CLAUDE.md                     # Project documentation
└── docs/                         # Additional documentation
    ├── DEVELOPMENT_GUIDE.md      # Development workflows
    ├── ARCHITECTURE.md           # This file
    ├── DATABASE_SCHEMA.md        # Database models
    ├── KNOWN_ISSUES.md           # Technical debt
    └── DEPLOYMENT.md             # Deployment guide
```

---

## Database Models

Current models in Prisma schema (see `prisma/schema.prisma` for details):

- **User** - User accounts with authentication
- **Role** - Role-based access control
- **ApiKey** - API authentication tokens
- **PasswdReset** - Password recovery tokens
- **Sensor** - Honeypot sensor tracking
- **Attack** - Attack metadata (PostgreSQL)
- **Rule** - IDS rules (Snort/Suricata format)
- **Reference** - Rule references (CVE, URLs)
- **RuleSource** - Rule download sources
- **RuleFetchJob** - Rule fetch job tracking
- **HPFeedsCredential** - Sensor credentials for broker
- **Integration** - External service configurations
- **IntegrationLog** - Integration event logs
- **Alert** - Alert definitions and triggers

See `docs/DATABASE_SCHEMA.md` for full model details.

---

## API Endpoints Quick Reference

### Working Endpoints (Phases 1-8)

**Authentication (17 endpoints)**
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/auth/me
- POST /api/auth/reset-request
- POST /api/auth/reset-confirm
- GET/POST/DELETE /api/role/*
- GET/POST/DELETE /api/apikey

**Sensor Management (6 endpoints)**
- POST /api/sensor
- GET /api/sensor
- GET/PUT/DELETE /api/sensor/:uuid
- POST /api/sensor/:uuid/connect

**Attack Data (7 endpoints)**
- GET /api/attack
- GET /api/attack/stats
- GET /api/attack/top-attackers
- GET /api/attack/geo
- GET /api/attack/sensor/:sensorId
- GET /api/attack/search
- GET /api/attack/:id

**Rules (11 endpoints)**
- POST /api/rule
- GET /api/rule
- GET/PUT/DELETE /api/rule/:id
- GET /api/rules.rules
- POST/GET/PUT/DELETE /api/rulesource/:id

**Analytics & Dashboard (21 endpoints)**
- GET /api/analytics/*
- GET /api/dashboard/*
- GET /api/export/*

**Integrations & Alerts (14 endpoints)**
- POST/GET/PUT/DELETE /api/integration/:type
- POST /api/alert/*

**User Management (5 endpoints)**
- POST /api/user
- GET /api/user
- GET/PUT/DELETE /api/user/:id

---

## Frontend Architecture

**Framework:** Next.js 15 with TypeScript 5.7

**Key Features:**
- Server-side rendering with React
- Built-in API routes and routing
- Image optimization
- CSS Modules and Tailwind CSS
- TypeScript support

**Pages:**
- `/login` - Authentication
- `/forgot-password` - Password reset
- `/dashboard` - Main dashboard with metrics
- `/attacks` - Attack list and search
- `/sensors` - Sensor management
- `/rules` - Rule management
- `/integrations` - Integration configuration
- `/analytics` - Data visualization
- `/settings` - User settings

**Components:**
- Authentication context (React hooks)
- Navigation bar
- Reusable UI components (cards, buttons, tables)
- Protected routes with redirects
- Error handling and loading states

---

## Service Architecture

### Core Services

**auth.service.ts** - Authentication
- Login/logout
- Token generation and refresh
- Password reset flow
- Token blacklist management

**user.service.ts** - User management
- CRUD operations
- Password hashing and validation
- User enumeration with filters

**sensor.service.ts** - Sensor tracking
- Sensor registration
- Check-in/heartbeat handling
- IP detection and updates
- Filter and search

**attack.service.ts** - Attack data
- MongoDB queries
- Filtering and aggregation
- Geographic analysis
- Time-series data

**rule.service.ts** - IDS rule management
- Rule parsing and validation
- CRUD operations
- Rule versioning
- Reference management
- Rule export in Snort format

**hpfeeds.service.ts** - HPFeeds broker
- Broker connection
- Event subscription
- Attack data ingestion
- Credential management

**analytics.service.ts** - Analytics
- Statistics aggregation
- Time-series generation
- Risk scoring
- Trend analysis

**email-notification.service.ts** - Email
- Multiple providers (SMTP, SendGrid, Mailgun)
- Template rendering
- Alert notifications

---

## Message Queues

**Bull Queues** (Redis-backed):
- `attack-events` - Attack data processing
- `security-alerts` - Alert notifications
- `statistics` - Analytics updates

**Scheduled Jobs** (node-cron):
- Rule fetching (configurable schedule)
- Alert evaluation (every 5 minutes)
- Statistics rollup (hourly/daily)

---

## Error Handling

**Pattern:** Custom error classes with status codes

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

**Global Handler:** Fastify error handler plugin catches all errors and returns formatted responses.

---

## Authentication Flow

1. **Login:** Email + password → bcrypt validation → JWT tokens (access + refresh)
2. **Request:** Include `Authorization: Bearer <token>` header
3. **Validation:** Fastify middleware validates token signature and expiry
4. **Refresh:** Expired access token → refresh endpoint → new token pair
5. **Logout:** Add token to blacklist (short-lived cache)

**API Key Alternative:** For sensor/script access, use static API keys with role-based permissions.

---

## Real-time Features

**WebSocket Support:** Socket.io (optional, not yet implemented)
- Live attack feed
- Sensor status updates
- Dashboard metrics

**Server-Sent Events (SSE):** Alternative for one-way updates

---

## Monitoring & Logging

**Pino Logger:**
- Structured JSON logging
- Automatic request ID tracking
- Performance metrics

**GitHub Actions CI/CD:**
- Tests on every PR
- Code formatting checks
- Automated releases

---

## Performance Considerations

- **Fastify:** ~40% faster than Express
- **Prisma:** Query optimization and connection pooling
- **MongoDB:** Indexed queries for attack data
- **Redis:** Optional caching layer (not yet integrated)
- **Bull:** Async job processing to avoid blocking requests

---

## Security Features

- **Password Hashing:** bcrypt with 10 salt rounds
- **JWT Tokens:** Signed with secret, 7-day expiry
- **RBAC:** Role-based access control with decorators
- **API Keys:** Unique keys per user, rotatable
- **HTTPS:** Recommended in production
- **CORS:** Configurable per environment
- **Rate Limiting:** Future enhancement

---

## Deployment

### Local Development

```bash
docker-compose up -d postgres mongodb
cd api && npm run dev
```

### Production

Requires:
1. PostgreSQL database
2. MongoDB instance
3. Redis cache (for Bull queues)
4. Docker containers for services
5. Environment variables configured
6. HTTPS/SSL certificates

See `docs/DEPLOYMENT.md` for full setup.
