# 02: Safe Router Deletion with Active Session Guard

**What to build:** Implement safe router deletion in the router service. If a router has active sessions, prevent destructive deletion by deactivating the router instead. If no active sessions exist, unregister the WireGuard peer and delete the database record. Delegate the administrator router deletion route handler to the service and return appropriate status messages based on whether the router was deactivated or permanently removed.

**Blocked by:** 01: Router Service Foundation, Creation Rollback & CRUD

**Status:** done

- [x] When deleting a router with one or more active sessions, the router service sets the router active flag to false and returns a deactivation response without deleting the database record or WireGuard peer.
- [x] When deleting a router with zero active sessions, the router service unregisters the WireGuard peer if a public key exists and deletes the database record.
- [x] Attempting to delete a non-existent router throws a descriptive not found error.
- [x] The administrator router deletion route handler delegates to the router service and maps deactivation vs deletion results to existing API response formats.
- [x] Unit tests verify both active session deactivation and zero-session hard deletion with WireGuard unregistration.
- [x] Existing administrator router integration tests for router deletion continue to pass.
