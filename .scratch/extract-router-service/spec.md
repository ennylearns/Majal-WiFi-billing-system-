# Extract Router Service from Admin Routes

Status: ready-for-agent

## Problem Statement

The administrator route dispatcher inlines router orchestration directly inside HTTP route handlers. WireGuard keypair generation, tunnel IP allocation, WireGuard peer registration, RouterOS API communication, active hotspot user queries, connection health diagnostics, and provisioning script generation are coupled with Express request and response objects. 

This coupling creates several critical problems:
1. Router domain orchestration cannot be tested in isolation; every test requires running an HTTP server.
2. If WireGuard peer registration fails after a router database record is created, the system leaves orphaned router records in the database with non-functional tunnels because there is no compensating rollback.
3. Hardware networking logic and external device connection timeouts bleed into HTTP handling, making route handlers brittle and hard to maintain.
4. Other parts of the system (such as automated tasks or CLI tools) cannot reuse router lifecycle or diagnostic logic without duplicating it or making HTTP requests to themselves.

## Solution

Extract a deep, cohesive `RouterService` module that owns all router lifecycle, WireGuard orchestration, and RouterOS diagnostic operations:
1. Router creation: handles auto-generating API credentials, generating WireGuard keypairs, allocating unique tunnel IPs, creating the database record, and registering the peer with WireGuard. If WireGuard registration fails, the service performs compensating cleanup by rolling back the database record.
2. Router retrieval and updates: provides centralized methods to list routers, retrieve a router by identifier, and update router properties.
3. Safe router deletion: prevents accidental disruption of active customer sessions. When active sessions exist on a router, the service deactivates the router instead of deleting it. When no active sessions exist, it unregisters the WireGuard peer and deletes the database record.
4. Router diagnostics: provides connection testing that evaluates the WireGuard tunnel handshake status first before attempting a RouterOS API connection, categorizing failures accurately (tunnel offline, authentication failure, host unreachable).
5. Hotspot telemetry: queries real-time active users directly from RouterOS.
6. Provisioning script generation: provides RouterOS provisioning scripts for physical router setup.

The administrator route layer is refactored into a thin dispatcher that validates request schemas using HTTP middleware and delegates all business logic to `RouterService`.

## User Stories

1. As a network administrator, I want to create a router with auto-generated credentials and WireGuard tunnel configuration in a single step, so that onboarding physical routers is seamless.
2. As a network administrator, I want router creation to roll back cleanly if WireGuard tunnel registration fails, so that partial or broken router records are never persisted.
3. As a network administrator, I want to list all configured routers, so that I have complete visibility over our network fleet.
4. As a network administrator, I want to view details for a specific router, so that I can inspect its configuration and tunnel settings.
5. As a network administrator, I want to update router details, so that configuration or location changes are updated reliably.
6. As a network administrator, I want to prevent accidental hard deletion of routers that currently have active user sessions, so that paying customers are not abruptly disconnected or left in an untracked state.
7. As a network administrator, I want a router with active sessions to be deactivated instead of deleted, so that new sessions cannot be initiated while ongoing sessions complete normally.
8. As a network administrator, I want deleting an idle router to automatically unregister its WireGuard peer, so that network tunnel interfaces and allocated IP addresses are freed.
9. As a network administrator, I want to test router connectivity and receive explicit failure classifications (tunnel offline, authentication failed, or unreachable), so that network troubleshooting is fast and accurate.
10. As a network administrator, I want to view real-time active hotspot users on a router, so that I can monitor client load and network utilization.
11. As a field technician, I want to fetch a RouterOS provisioning script as JSON or plain text, so that I can easily configure a router via terminal or automated scripts.
12. As a developer, I want the router service constructor to accept optional database and WireGuard dependencies, so that I can unit-test router lifecycle logic in complete isolation without live databases or network devices.
13. As a developer, I want the admin router route handlers to be thin dispatchers, so that HTTP request validation and domain logic are clearly separated.
14. As a developer, I want domain operations to throw plain errors that route handlers can catch and map to standard HTTP status codes, maintaining consistent API response contracts.
15. As a developer, I want existing router integration tests to continue passing without regressions, ensuring existing client expectations are preserved.

## Implementation Decisions

- **Dedicated Deep Module**: Extract a centralized router service module that encapsulates all router data management, WireGuard orchestration, and RouterOS interactions.
- **Thin Route Dispatcher**: Admin route handlers retain HTTP-specific concerns, including request validation using validation middleware, parameter extraction, and status code mapping, but delegate all domain logic to the router service.
- **Dependency Injection**: The router service class constructor accepts optional database client and WireGuard service instances, falling back to default singletons, enabling clean unit testing with mocked dependencies.
- **Compensating Rollback on Creation**: When creating a router, if WireGuard peer registration throws an error after the database record is inserted, the service catches the failure, deletes the created database record, and re-throws the error.
- **Safe Deletion Policy**:
  - If a router has active sessions (status is active), the service updates the router's active state to false and returns a deactivation result.
  - If a router has no active sessions, the service unregisters the WireGuard peer (if a public key exists), deletes the database record, and returns a deletion result.
- **Two-Tier Diagnostics**:
  - For routers with WireGuard keys configured, the service checks tunnel handshake status first. If offline, diagnostics immediately return tunnel offline without attempting a timed-out RouterOS API connection.
  - If the tunnel is online (or WireGuard is not used), the service attempts a RouterOS API connection and classifies connection errors into authentication failures or general reachability errors.
- **Domain Error Handling**: The router service communicates domain errors by throwing standard errors with descriptive messages (e.g., entity not found). Route handlers catch these errors and map them to appropriate HTTP error responses (e.g., 404 or 500).
- **Scope Isolation**: Admin route endpoints for dashboard, users, plans, sessions, and payments remain in the existing admin route dispatcher without introducing additional service extractions in this iteration.

## Testing Decisions

- **Testing Philosophy**: Tests must exercise public module interfaces and observable behavioral contracts rather than implementation details or private methods.
- **Testing Seams**:
  1. *Unit Testing Seam*: The public interface of the newly created router service, tested with mock database and WireGuard clients.
  2. *Integration Testing Seam*: The existing administrator router HTTP endpoints, exercised via HTTP requests against the application server.
- **Unit Test Scenarios for Router Service**:
  - *Router Creation*: Successfully allocates tunnel IP, creates database record, and registers WireGuard peer.
  - *Compensating Cleanup*: Verifies that when WireGuard peer registration fails, the newly created database record is removed and an error is raised.
  - *Active Session Deactivation*: Verifies that deleting a router with active sessions deactivates it without removing the database record or WireGuard peer.
  - *Idle Router Deletion*: Verifies that deleting a router with zero active sessions unregisters the WireGuard peer and removes the database record.
  - *Tunnel Offline Diagnostic*: Verifies that connection testing flags an offline tunnel when WireGuard handshake has not occurred.
  - *Auth Failed Diagnostic*: Verifies that connection testing recognizes invalid credentials and flags authentication failure.
  - *Online Diagnostic*: Verifies successful RouterOS handshake and connection teardown.
- **Prior Art**: Follows patterns established in the codebase for constructor-injected service unit tests and Node test runner integration suites.

## Out of Scope

- Extracting domain services for dashboard, user, plan, session, or payment entities.
- Splitting the admin route dispatcher file into a directory of sub-routers.
- Implementing automated background polling or health check cron jobs for routers.
- Modifying the RouterOS provisioning script templates or commands.

## Further Notes

- Existing integration test suites for administrator router endpoints must remain fully compatible and pass without modifications to external HTTP contracts.
