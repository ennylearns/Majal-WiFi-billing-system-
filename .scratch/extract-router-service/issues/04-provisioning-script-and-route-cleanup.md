# 04: Provisioning Script Generation & Admin Route Cleanup

**What to build:** Move provisioning script generation into the router service and complete the cleanup of the administrator route dispatcher. Delegate the provisioning script route handler to the router service, supporting both JSON and plain-text responses. Remove redundant router-specific networking, crypto, and direct device dependencies from the administrator route dispatcher file so it functions strictly as a thin dispatcher. Run all unit and integration test suites to confirm zero regressions.

**Blocked by:** 02: Safe Router Deletion with Active Session Guard, 03: Router Diagnostics & Active User Telemetry

**Status:** done

- [x] The router service provides a method to generate the RouterOS provisioning script for a registered router.
- [x] The administrator provisioning script route handler delegates to the router service and maintains content negotiation for plain text and JSON outputs.
- [x] Direct hardware connection, script generation, and cryptography imports are removed from the administrator route file where no longer needed.
- [x] The administrator route file serves as a thin dispatcher for all router operations.
- [x] All router service unit tests and integration tests pass without failures.

