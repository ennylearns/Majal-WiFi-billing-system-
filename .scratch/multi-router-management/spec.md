# Multi-Router Management

Status: ready-for-agent

## Problem Statement

The system is hardwired to a single MikroTik router via environment variables. An operator running hotspot billing across multiple physical locations (e.g. different floors or buildings) cannot register more than one router, cannot assign plans to specific routers, and cannot see which router a session is running on. Every hotspot user is created on the same router regardless of where the customer actually is.

## Solution

Introduce a **Router** entity that admins manage through the admin dashboard. Each Plan is assigned to exactly one Router. When a customer purchases a Plan, their hotspot user is created on that Plan's Router. The customer portal groups Plans by Router location so customers can see what is available at their location. A one-time seed migrates the existing env-var router config into the database on first start so no manual re-entry is needed.

## User Stories

1. As an admin, I want to add a new router to the system, so that I can extend the billing system to cover a new physical location.
2. As an admin, I want to provide a friendly name and location description for each router, so that I and my staff can identify which physical device is which.
3. As an admin, I want to provide connection credentials (host, port, username, password) for each router, so that the backend can connect to it via the MikroTik API.
4. As an admin, I want to test the connection to a router directly from the dashboard, so that I can verify credentials before assigning plans to it.
5. As an admin, I want to view all registered routers in a table, so that I have a single overview of my entire network infrastructure.
6. As an admin, I want to edit a router's name, location, or credentials, so that I can keep the records accurate when hardware changes.
7. As an admin, I want to delete a router from the system, so that I can remove decommissioned hardware from the records.
8. As an admin, I want each plan to be assigned to a specific router when I create or edit it, so that I can control which physical router handles customers on that plan.
9. As an admin, I want the plan creation form to show a dropdown of registered routers, so that I can select the correct one without typing credentials manually.
10. As an admin, I want to see which router a plan belongs to in the plans list, so that I can audit the plan-to-router mapping at a glance.
11. As an admin, I want the dashboard router status view to show active hotspot users per router, so that I can monitor all routers from one place.
12. As an admin, I want the existing env-var router configuration to be automatically migrated to the database on first start, so that I do not need to re-enter credentials after upgrading.
13. As a customer, I want to see all available plans grouped by router location, so that I can choose a plan for the location I am physically at.
14. As a customer, I want my hotspot credentials to be created on the correct router when I complete a payment, so that I can actually connect to the internet at my location.
15. As a customer, I want my session to be terminated on the correct router when my plan expires, so that my credentials are properly cleaned up.
16. As an admin, I want terminated and expired sessions to be cleaned up on the correct router, so that unused hotspot users do not accumulate on any device.

## Implementation Decisions

- **Router model**: A new `Router` entity is introduced to the database schema with the following fields: unique ID, `name` (friendly label), `location` (human-readable description of physical placement), `host` (IP or hostname), `port` (integer, defaults to 8728), `username`, `password` (stored in plain text — acceptable for internal admin use), `isActive` flag, and timestamps. Router credentials are stored in plain text in the database.

- **Plan-Router association**: The `Plan` entity gains a `routerId` foreign key referencing `Router`. This is a required field going forward. During the migration seed, existing plans are updated to reference the seeded default router.

- **Session-Router denormalization**: The `Session` entity stores a `routerId` field (copied from its Plan at session creation time). This avoids a join when terminating or cleaning up sessions and keeps the audit trail accurate even if a plan's router is later changed.

- **MikrotikService refactor**: The service is refactored from a module-level singleton (constructed once from env vars) to a class whose constructor accepts explicit credentials (`host`, `port`, `username`, `password`). A factory function looks up a Router record by ID from the database and returns a configured `MikrotikService` instance. The per-call connect/disconnect pattern is preserved unchanged.

- **Session creation flow**: `sessionService.createSession()` accepts the Plan's `routerId`, fetches the Router record, constructs a `MikrotikService` instance for that router, and uses it to create the hotspot user profile and hotspot user. The `routerId` is stored on the new Session record.

- **Session termination flow**: `sessionService.terminateSession()` reads `routerId` from the Session record, constructs the appropriate `MikrotikService` instance, and removes the hotspot user from the correct router.

- **Session cleanup cron**: The periodic cleanup job resolves each expired session's router via the session's stored `routerId` before terminating, so every router is cleaned up independently.

- **Admin router API**: New endpoints under `/api/admin/routers`:
  - `GET /` — list all routers
  - `POST /` — create a router
  - `PUT /:id` — update a router
  - `DELETE /:id` — delete a router (soft delete via `isActive = false`, or hard delete if no sessions reference it)
  - `POST /:id/test-connection` — attempt to connect to the router and return success/failure

- **Plans API update**: The plan create and update endpoints accept and return `routerId`. The public plans endpoint returns `routerId` and the router's `name`/`location` so the frontend can group plans without a separate request.

- **Migration seed**: On server startup, if `MIKROTIK_HOST` is present in the environment and no Router records exist in the database, one Router record is created from the env-var values. Its name defaults to `"Default Router"` and location to `"Main Location"`. All existing Plans are updated to reference this seeded router. Env vars remain supported as a seed source but are no longer the live connection config once any router exists in the DB.

- **Admin UI — Routers tab**: A new "Routers" section is added to the admin dashboard. It displays a table of routers with columns for name, location, host, status, and actions (edit, delete, test connection). A modal handles add and edit operations.

- **Admin UI — Plans form update**: The plan create/edit modal gains a "Router" dropdown populated from the routers API. The plans table gains a "Router" column showing the router name.

- **Customer portal — plan grouping**: The plans list on the customer portal renders plans grouped under their router's name/location as a section heading, instead of a flat list.

## Testing Decisions

- **What makes a good test**: Tests assert only observable external behaviour — API response shapes, database state after a call, or MikroTik API commands issued — not internal wiring or call order. Tests should not reach into private methods or assert that a specific import was used.

- **MikrotikService unit tests**: Instantiate the refactored class with explicit stub credentials. Mock `RouterOSAPI` from `node-routeros` at the module boundary. Assert that the correct API commands and arguments are written for each public method (`createHotspotUser`, `removeHotspotUser`, `getActiveUsers`, `disconnectUser`, `createUserProfile`, `updateUserProfile`). Prior art: `paystackService.test.ts` shows the pattern of mocking an external SDK and asserting method calls.

- **Admin router API integration tests**: Drive the full HTTP stack (Express app + Prisma against a test database). Assert correct response bodies and status codes for all CRUD operations and the test-connection endpoint. Prior art: `public.test.ts` shows the pattern of mounting the Express app and making HTTP requests in tests.

- **No separate tests for session routing logic**: The correct-router behaviour is covered transitively by the session creation and termination paths already exercised in integration tests — no additional seam is needed.

## Out of Scope

- Load balancing or auto-assigning routers based on capacity or client IP.
- A single plan being offered across multiple routers simultaneously.
- Encrypting router credentials at rest.
- Switching the database from SQLite to PostgreSQL.
- Real-time router health monitoring or alerting.
- Per-router revenue or usage analytics dashboards.
- Multi-tenant isolation (each router owned by a different business entity).

## Further Notes

- The env-var names `MIKROTIK_HOST`, `MIKROTIK_USERNAME`, `MIKROTIK_PASSWORD`, `MIKROTIK_PORT` can be retained in `.env.example` with a comment explaining they are only used for the one-time seed.
- If the seed runs and the env vars are absent (fresh install), the admin must add the first router manually via the UI before any plans can be created.
- The `isActive` flag on `Router` is reserved for future soft-disable behaviour; all created routers are active by default.
