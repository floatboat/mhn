# Development Guide

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

1. **Route** ([api/user.route.ts:15](../api/src/routes/api/user.route.ts#L15)) - Defines endpoint
   ```typescript
   fastify.post('/api/user', {
     schema: createUserSchema,  // Validation
     handler: createUserHandler  // Business logic
   })
   ```

2. **Handler** ([user.handler.ts:25](../api/src/handlers/user.handler.ts#L25)) - Processes HTTP request/response
   ```typescript
   async function createUserHandler(request, reply) {
     const { name, email, password } = request.body
     const user = await createUser(name, email, password)
     reply.code(201).send(user)
   }
   ```

3. **Service** ([user.service.ts:23](../api/src/services/user.service.ts#L23)) - Contains business logic
   ```typescript
   async function createUser(name, email, password) {
     // Check duplicates
     // Hash password
     // Create in database
     // Return user (exclude password)
   }
   ```

4. **Prisma** ([prisma.ts:7](../api/src/lib/prisma.ts#L7)) - Database access
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

**Error Handler Plugin** ([errorHandler.ts](../api/src/plugins/errorHandler.ts)):
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

# Install root dependencies
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

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
```

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

---

## Testing Strategy

### Test Coverage Goals

- Unit tests: >80% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user flows

### Test File Structure

```
test/
├── __mocks__/        # Shared mocks
├── unit/             # Unit tests
├── integration/      # Integration tests
└── e2e/              # End-to-end tests
```

### Mocking Best Practices

- Always mock Prisma in unit tests
- Mock external APIs (HPFeeds, GeoIP)
- Use test database for integration tests
