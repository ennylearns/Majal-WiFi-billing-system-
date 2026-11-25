# 03: Wire Payment Service & Mock Simulation

**What to build:** Connects `PaymentService` to `BachsGateway` as the default payment gateway and updates mock mode (`MOCK_SERVICES=true`) to simulate Bachs `collection.succeeded` webhook callbacks after 5 seconds so local development and automated tests run offline.

**Blocked by:** 02: Route Webhook Endpoint & Wire Fulfillment

**Status:** ready-for-agent

- [ ] `PaymentService` defaults to `BachsGateway` when no gateway instance is injected.
- [ ] In `MOCK_SERVICES=true` mode, initiating a payment schedules a simulated `collection.succeeded` webhook callback after 5 seconds with a valid HMAC-SHA256 signature and timestamp header.
- [ ] End-to-end payment initiation, status polling fallback, and mock webhook fulfillment work seamlessly without external network calls.
- [ ] Payment route and service tests pass with the wired `BachsGateway` and updated mock simulation.
