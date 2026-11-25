# Migrate Payment Gateway from Paystack to Bachs.io

Status: ready-for-agent

## Problem Statement

The billing system currently uses Paystack as its sole payment gateway adapter for processing WiFi plan purchases. The business wants to migrate to Bachs.io for payment collection to leverage its pan-African corridor support and modernized checkout capabilities, while retaining existing one-time plan purchase flows, customer experience, and fulfillment reliability.

## Solution

Replace the Paystack payment gateway adapter with a `BachsGateway` implementing the existing `PaymentGateway` interface. Update payment initiation to create Bachs checkout sessions in NGN decimal currency, verify incoming Bachs webhooks (`X-Bachs-Signature` / `X-Bachs-Signature-V2` with HMAC-SHA256 and timestamp verification), handle `collection.succeeded` and `checkout.completed` events, route webhooks through a clean `/payments/webhook` endpoint, and update environment configuration and automated test suites.

## User Stories

1. As a captive portal customer, I want to initiate a payment for an internet plan using phone number or email, so that I receive a hosted checkout URL to complete payment via card or bank transfer.
2. As a captive portal customer, I want my payment checkout session restricted to NGN payment methods (card, bank transfer), so that I am not confused by unsupported payment corridors.
3. As a captive portal customer, I want the system to seamlessly direct me back to the captive portal with my payment reference, so that my device network session is activated upon settlement.
4. As a captive portal customer, I want status polling to fall back to verifying the checkout session directly if my network disconnects or webhooks are delayed, so that my payment still fulfills promptly.
5. As an ISP administrator, I want payment fulfillment to happen exactly once regardless of whether `collection.succeeded` or `checkout.completed` arrives first, so that the customer does not receive duplicate sessions or duplicate confirmation SMS.
6. As an ISP administrator, I want untrusted or replayed webhook requests rejected (outside the 300-second timestamp tolerance or with invalid signatures), so that rogue requests cannot forge plan activations.
7. As an ISP developer, I want sandbox vs live environments to be auto-detected based on the API key prefix (`sk_sandbox_` vs `sk_live_`), so that configuration mistakes between sandbox credentials and live endpoints are prevented.
8. As an ISP developer, I want local mock mode (`MOCK_SERVICES=true`) to simulate Bachs webhook callbacks after 5 seconds, so that offline development and automated pipeline testing continue without external network calls.
9. As an ISP developer, I want all legacy Paystack service files, unused adapters, and legacy tests deleted, so that the codebase remains clean, maintainable, and free of dead vendor code.

## Implementation Decisions

### 1. Payment Gateway Adapter Replacement
- Delete `PaystackGateway` and replace with `BachsGateway` in the gateway module implementing `PaymentGateway`.
- Delete `paystackService.ts` and its direct exports; all routing and service consumption flows through the consolidated `PaymentService`.
- Auto-detect API base URL based on `BACHS_API_KEY`:
  - Starts with `sk_sandbox_`: `https://sandbox-api.bachs.io`
  - Starts with `sk_live_`: `https://api.bachs.io`
  - Otherwise throw an initialization error.
- Configure supported corridors via `BACHS_PAYMENT_METHODS` environment variable (default: `NGN_CARD,NGN_BANK_TRANSFER`).

### 2. Transaction Initiation Contract
- `BachsGateway.initiateTransaction` issues `POST /v1/checkout-sessions` using raw `fetch`.
- Amount formatting: Major currency units formatted as decimal string with two decimals (e.g., `params.amount.toFixed(2)`), never kobo integers.
- Session parameters:
  - `pricing`: `{ currency: "NGN", amount: "<formatted-amount>" }`
  - `billing_currency`: `"NGN"`
  - `payment_method_types`: `["NGN_CARD", "NGN_BANK_TRANSFER"]`
  - `reference`: `payment.id` (database UUID, guaranteeing gateway idempotency)
  - `metadata`: `{ paymentId: payment.id, planId: params.planId, ...(params.metadata || {}) }`
  - `customer`: `{ email: gatewayEmail }`
  - `customer_creation`: `"if_required"`
- Adapt response to internal `InitiatePaymentResult`:
  - `reference`: `checkout_id` (e.g. `chk_...`)
  - `access_code`: `checkout_id` (preserves backward compatibility with existing route responses)
  - `authorization_url`: `checkout_url`

### 3. Webhook Signature Verification and Routing
- Route endpoint updated to `POST /payments/webhook`.
- Verify `X-Bachs-Signature` / `X-Bachs-Signature-V2` using HMAC-SHA256 computed over `"${timestamp}.${rawBody}"` with `BACHS_WEBHOOK_SECRET`.
- Enforce replay attack prevention: reject requests where `Math.abs(Date.now() / 1000 - Number(timestamp)) > 300` seconds.
- Route dispatch handles both `collection.succeeded` and `checkout.completed`:
  - Look up payment via `data.checkout_id` (matching `checkoutRequestId`) or `metadata.paymentId`.
  - Trigger `paymentService.fulfillPayment` with deduplication handled by the atomic `PENDING -> COMPLETED` database check-and-set.
- Update route reserved segments in `routes/payments.ts` to include `'webhook'` and remove `'paystack'`.

### 4. Direct Status Verification Fallback
- `BachsGateway.verifyTransaction(reference)` queries `GET /v1/checkout-sessions/{reference}`.
- Map statuses:
  - `"PAID"` -> `{ status: "success", amount, reference }`
  - `"EXPIRED"` / `"FAILED"` -> `{ status: "failed", amount, reference }`
  - default -> `{ status: "pending", amount, reference }`

### 5. Environment Variables
- Remove `PAYSTACK_SECRET_KEY`.
- Introduce `BACHS_API_KEY` (required in non-mock mode).
- Introduce `BACHS_WEBHOOK_SECRET` (required for signature verification).
- Introduce `BACHS_PAYMENT_METHODS` (optional string list).

### 6. Deployment Strategy
- Hard cut deployment: existing in-flight pending payments from the legacy gateway are stopped at deploy time without parallel dual-gateway endpoints.

## Testing Decisions

- **Test Boundaries**: Test external behavior through existing public seams:
  1. Unit tests for `BachsGateway` testing initiation payload building, decimal string amounts, auto-URL detection, status verification mapping, and HMAC-SHA256 signature checking.
  2. Integration tests for `/payments` HTTP endpoints using mock mode or `FakePaymentGateway` to verify initiation, status check, and webhook receipt.
- **Prior Art**: Follow patterns in `backend/src/services/tests/paymentGateway.test.ts` and `backend/src/routes/tests/payments.test.ts`.
- **Legacy Cleanup**: Remove `paystackService.test.ts` and replace Paystack-specific gateway tests with Bachs-specific gateway tests.

## Out of Scope

- Recurring subscription checkouts (`billing_cycle` products).
- Multi-currency / non-NGN corridors (e.g., crypto, USD card, Momo KES/GHS).
- Dual-gateway runtime coexistence or gradual live traffic cutover.
- Database schema changes (existing `Payment` model and fields remain unchanged).

## Further Notes

- The existing `FakePaymentGateway` class in `paymentGateway.ts` will be retained and updated if necessary to support fake webhook signature generation for internal tests.
