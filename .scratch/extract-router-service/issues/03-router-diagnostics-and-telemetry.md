# 03: Router Diagnostics & Active User Telemetry

**What to build:** Implement router connection testing and active hotspot user telemetry inside the router service. Diagnostic testing first checks WireGuard tunnel handshake status when a public key is configured; if the tunnel is offline, return an offline status immediately without stalling on downstream API timeouts. If the tunnel is healthy or unconfigured, attempt RouterOS API connection and categorize connection failures into authentication failures or reachability errors. Provide a method to query currently active hotspot users on a router. Delegate the administrator router test-connection and router status route handlers to the service.

**Blocked by:** 01: Router Service Foundation, Creation Rollback & CRUD

**Status:** ready-for-agent

- [ ] Testing connection for a router with a WireGuard key evaluates handshake status first, returning a tunnel offline status if inactive.
- [ ] Testing connection with an active tunnel attempts RouterOS connection and disconnects cleanly upon success, returning an online status.
- [ ] RouterOS connection errors during diagnostics are analyzed and classified into authentication failed or unreachable statuses.
- [ ] Active hotspot users are queried from RouterOS for a given router and returned with user counts and details.
- [ ] The administrator test-connection and router status route handlers delegate to the router service.
- [ ] Unit tests verify handshake failure handling, credential failure classification, unreachable classification, and successful diagnostic flows.
- [ ] Existing administrator router integration tests for test-connection and status continue to pass.
