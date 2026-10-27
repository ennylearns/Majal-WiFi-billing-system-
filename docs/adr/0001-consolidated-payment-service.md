# Consolidate Payment Subsystem into Deep PaymentService

## Context
Payment handling was scattered across `routes/public.ts` (guest checkout, polling, webhook reception), `routes/payments.ts` (user history), `routes/admin.ts` (admin listing), and `services/paystackService.ts` (gateway calls). This resulted in leaked database queries, race conditions during fulfillment between webhooks and polling, and poor testability.

## Decision
1. **Deep `PaymentService`**: Encapsulates payment lifecycle (`initiatePayment`, `fulfillPayment`, `checkStatus`, `handleWebhook`, `getUserPayments`, `listPayments`).
2. **Gateway Adapter Seam**: `PaymentService` interacts with payment providers through a `PaymentGateway` interface (`PaystackGateway` implementation), allowing fake gateways in tests.
3. **Atomic Idempotent Fulfillment**: Transitions `PENDING -> COMPLETED` via database transaction, guaranteeing exactly-once session creation and SMS notification under concurrent webhook/polling events.
4. **Route Compatibility & Locality**: All payment HTTP handlers reside in `routes/payments.ts`. `routes/public.ts` forwards `/payment/*` requests to maintain external contract compatibility for Paystack webhooks and frontend callers.
