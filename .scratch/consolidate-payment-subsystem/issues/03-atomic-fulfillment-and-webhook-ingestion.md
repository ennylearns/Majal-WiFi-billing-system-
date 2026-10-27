# 03: Implement Atomic Idempotent Fulfillment and Webhook Ingestion

**What to build:** An atomic, idempotent payment fulfillment engine that processes incoming payment gateway webhooks and client status polling, verifies cryptographic signatures, atomically transitions payments to completed, activates router network sessions, and dispatches SMS confirmations without race conditions or duplicate sessions.

**Blocked by:** 02: Implement Payment Initiation and Guest Resolution

**Status:** ready-for-agent

- [ ] Webhook receiver passes raw payload and signature to the payment service, rejecting unverified requests
- [ ] Successful charge webhook triggers idempotent fulfillment using the gateway reference
- [ ] Atomic database transaction verifies payment is in pending status before transitioning to completed
- [ ] On transition to completed, fulfillment invokes the session service to create or extend active router network sessions
- [ ] On transition to completed, fulfillment sends a payment receipt SMS to the customer
- [ ] Client status check queries payment state, triggering fulfillment if gateway confirmed settlement and returning active session token
- [ ] Concurrent webhook and polling requests for the same payment reference execute exactly-once fulfillment without duplicated sessions or SMS messages
- [ ] Tests verify idempotent execution under simulated race conditions
