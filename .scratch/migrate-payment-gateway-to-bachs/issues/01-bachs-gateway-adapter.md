# 01: Implement BachsGateway Adapter & Unit Tests

**What to build:** The core payment gateway adapter capable of creating Bachs checkout sessions with NGN decimal formatting, verifying HMAC-SHA256 webhook signatures with 300-second timestamp tolerance, and polling checkout session status. Fully verified by isolated unit tests.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `BachsGateway` implements `PaymentGateway` interface.
- [ ] Auto-detects API base URL from `BACHS_API_KEY` prefix (`sk_sandbox_` vs `sk_live_`) and throws on missing or unrecognized keys in non-mock mode.
- [ ] `initiateTransaction` posts to `/v1/checkout-sessions` with amount formatted as major-unit decimal string (two decimals), `billing_currency: "NGN"`, configured `BACHS_PAYMENT_METHODS` (default `NGN_CARD,NGN_BANK_TRANSFER`), `customer_creation: "if_required"`, `reference` set to `payment.id`, and `metadata` carrying `paymentId` and `planId`.
- [ ] Maps `checkout_id` to both `reference` and `access_code`, and `checkout_url` to `authorization_url`.
- [ ] `verifyTransaction` queries `/v1/checkout-sessions/{reference}` and maps `PAID` -> `success`, `EXPIRED`/`FAILED` -> `failed`, and others -> `pending`.
- [ ] `verifyWebhookSignature` validates HMAC-SHA256 over `"{timestamp}.{rawBody}"` using `BACHS_WEBHOOK_SECRET` and rejects requests outside a 300-second timestamp tolerance window.
- [ ] Isolated unit tests cover initiation payload building, decimal string formatting, URL auto-detection, status mapping, and signature/replay verification.
