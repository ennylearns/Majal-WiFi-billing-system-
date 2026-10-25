# Eliminate Scattered PrismaClient Instantiation

Status: ready-for-agent

## Problem Statement

Across the backend codebase, `new PrismaClient()` is instantiated independently in at least 15 separate locations spanning routes, services, middleware, seed scripts, and integration test files. Each `PrismaClient` instance establishes and maintains its own database connection pool. In a running Node process and during local development or testing, this causes:
1. Redundant connection pools exhausting database connection limits.
2. Absence of a centralized seam to configure database options, logging, or lifecycle hooks.
3. Inability for services to undergo test substitution without global monkey patching or mock-heavy workarounds (e.g., `SessionService` references a module-scoped `new PrismaClient()` and cannot be tested with mock fixtures).
4. Disconnected connection lifecycles between integration tests and the route handlers they exercise, where test suites create and disconnect their own client while leaving route-level connection pools open.

## Solution

Introduce a single, centralized database client module at `backend/src/database/db.ts` that exports a shared `PrismaClient` singleton and lifecycle helpers.
1. Implement the standard Prisma singleton caching pattern using `globalThis` in non-production environments to prevent connection exhaustion during development reloads.
2. Standardize all domain services (`RouterService`, `RouterSeedService`, `PaystackService`, and `SessionService`) to accept an optional `prismaClient: PrismaClient = prisma` parameter in their constructors, storing the client on `this.prisma` and using it across all instance methods.
3. Replace all inline `new PrismaClient()` calls in routes (`admin.ts`, `public.ts`, `auth.ts`, `plans.ts`, `payments.ts`, `sessions.ts`) and middleware (`auth.ts`) with imports from `backend/src/database/db.ts`.
4. Update database seed scripts and HTTP integration tests to share the central client rather than instantiating ad-hoc instances.

## User Stories

1. As a platform developer, I want a single source of truth for the database client, so that database connection configuration and logging reside in one module.
2. As a platform developer, I want all services to accept PrismaClient via constructor injection with default fallback, so that unit tests can inject mock databases without spinning up real databases.
3. As a developer running local tests and reload servers, I want PrismaClient instances cached across reloads in non-production, so that PostgreSQL connection pools are not exhausted.
4. As a test engineer, I want HTTP integration test suites to share the same PrismaClient connection pool as route handlers, so that test fixtures and handler operations see consistent transaction states without orphaned connections.
5. As a network operator, I want server startup and shutdown to cleanly manage database connections, preventing leaked connections when the application process terminates.
6. As a developer maintaining `SessionService`, I want methods like `createSession`, `terminateSession`, and `sessionCleanup` to use the injected client, enabling unit testing of session lifecycles.
7. As a developer maintaining `PaystackService`, I want the constructor default to reference the shared database singleton cleanly rather than invoking `new PrismaClient()` inline.

## Implementation Decisions

- **Singleton Location**: The centralized database client module is placed at `backend/src/database/db.ts`.
- **Global Caching Pattern**: `db.ts` checks `globalThis.prisma`. In non-production environments (`NODE_ENV !== 'production'`), the client instance is assigned to `globalThis.prisma` to survive module re-evaluations.
- **Exported Surface**: `db.ts` exports `prisma` (named and default) as well as a `disconnectDb()` lifecycle helper.
- **Service Dependency Injection**: All services (`RouterService`, `RouterSeedService`, `PaystackService`, `SessionService`) follow the same uniform constructor pattern:
  `constructor(prismaClient: PrismaClient = prisma, ...)`
  and reference `this.prisma` internally.
- **Strict Separation of Testing**:
  - Unit tests inject lightweight in-memory mock objects into service constructors without touching the database or `db.ts`.
  - HTTP integration tests (`admin.routers.test.ts`, `admin.plans.test.ts`, `public.test.ts`) import the shared singleton from `backend/src/database/db.ts` to exercise genuine queries against the test database.
- **Routes & Middleware Refactoring**: Routes remain thin dispatchers and import `{ prisma } from '../database/db'`.

## Testing Decisions

- **Unit Tests for db.ts**: Verify `backend/src/database/db.ts` exports valid client instances and respects `globalThis` caching.
- **Unit Tests for SessionService**: Verify `SessionService` accepts custom mock Prisma clients in its constructor and executes queries via `this.prisma`.
- **Regression Suite**: Run `npm test` across all unit and integration test suites to ensure zero behavioral regressions after migrating all 15 call sites.

## Out of Scope

- Introducing full repository pattern or ORM abstraction layers over Prisma.
- Modifying Prisma schema, migrations, or database models.
- Changing route handler endpoints or request/response payload contracts.

## Follow-up Work

- Tracked in [05-prototype-service-extraction-prevent-route-db-leakage.md](issues/05-prototype-service-extraction-prevent-route-db-leakage.md): Prototype extracting domain services (`planService`, `authService`, etc.) to completely eliminate DB imports from routes.

