# 01: Router Service Foundation, Creation Rollback & CRUD

**What to build:** Create the router service with constructor dependency injection for database and WireGuard clients. Implement router creation with automatic credential generation, WireGuard keypair generation, tunnel IP allocation, and compensating rollback: if WireGuard peer registration fails after saving the database record, delete the newly created record and propagate the failure cleanly. Implement router listing, single router retrieval, and updates. Delegate the corresponding administrator router endpoints to the new service while keeping schema validation in the route layer.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The router service provides constructor dependency injection for database and WireGuard dependencies, defaulting to standard singletons when omitted.
- [ ] Creating a router automatically generates API credentials, creates a WireGuard keypair, allocates an available tunnel IP, stores the record, and registers the WireGuard peer.
- [ ] If WireGuard peer registration fails during router creation, the created database record is rolled back and an error is thrown.
- [ ] Router listing, single router retrieval, and updating operations are supported by the router service.
- [ ] The administrator router creation, listing, retrieval, and update route handlers delegate to the router service.
- [ ] Unit tests verify router creation happy path, compensating rollback on WireGuard failure, and router retrieval/updates using mock dependencies.
- [ ] Existing administrator router integration tests for creation, listing, and updates continue to pass.
