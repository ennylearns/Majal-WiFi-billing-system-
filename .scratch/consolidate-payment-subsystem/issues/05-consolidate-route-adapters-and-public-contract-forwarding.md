# 05: Consolidate Route Adapters and Public Contract Forwarding

**What to build:** Unification of all payment HTTP endpoints into a single cohesive route adapter module while preserving external route contracts on public routes to guarantee uninterrupted operation for external webhooks, captive portals, and frontend client calls.

**Blocked by:** 03: Implement Atomic Idempotent Fulfillment and Webhook Ingestion, 04: Implement Customer Payment History and Admin Listing

**Status:** ready-for-agent

- [ ] Consolidate payment endpoints (initiate, status, webhook, customer history, payment detail) into the dedicated payments route module
- [ ] Ensure route controllers serve only as HTTP transport adapters (validating inputs, passing parameters to the payment service, returning status codes)
- [ ] Configure public route router to forward `/payment/*` subpaths to the payments route module, maintaining existing URL contracts
- [ ] Verify frontend API calls (`/public/payment`, `/payments`, `/admin/payments`) and Paystack webhook callbacks function without URL breakage
- [ ] Purge redundant, obsolete database queries and dead payment code from public and administrative route modules
- [ ] Full end-to-end integration test suite passes across all payment endpoints
