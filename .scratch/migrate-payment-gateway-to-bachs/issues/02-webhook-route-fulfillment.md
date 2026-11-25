# 02: Route Webhook Endpoint & Wire Fulfillment

**What to build:** A generic `POST /payments/webhook` route that authenticates incoming Bachs webhooks, handles both `collection.succeeded` and `checkout.completed` events, atomically transitions payment records, provisions network sessions, and dispatches confirmation SMS.

**Blocked by:** 01: Implement BachsGateway Adapter & Unit Tests

**Status:** ready-for-agent

- [ ] `POST /payments/webhook` endpoint accepts raw request body and passes signature/timestamp headers to `PaymentService` for verification.
- [ ] Route reserved segments exclude `webhook` (and remove `paystack`) so `GET /payments/:id` does not collide with the webhook path.
- [ ] `PaymentService` webhook handler processes both `collection.succeeded` and `checkout.completed` events, resolving the payment via `data.checkout_id` or `metadata.paymentId`.
- [ ] Atomic `PENDING -> COMPLETED` database transition deduplicates dual-fired events so network session provisioning and SMS confirmation execute at most once per payment.
- [ ] Integration tests verify valid signature acceptance, invalid/expired signature rejection, and idempotent fulfillment across both event types.
