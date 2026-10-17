Status: ready-for-agent

# Spec: Replace M-Pesa with Paystack

## Problem Statement

The WiFi billing system currently uses M-Pesa (Safaricom Daraja STK Push) as its sole payment gateway. The business needs to accept payments via Paystack instead — supporting card and bank-transfer channels — while preserving the existing end-to-end flow: a customer selects a plan, pays, and is immediately granted an active internet session.

## Solution

Replace the M-Pesa payment service with a Paystack integration using the Paystack Popup (inline JS widget on the customer portal). The backend verifies payment authenticity via a Paystack webhook and updates the payment record. The customer portal continues to poll the backend for payment status and grants internet access once confirmed. All M-Pesa-specific code, environment variables, and database fields are removed.

## User Stories

1. As a customer, I want a payment popup to appear directly on the captive portal page, so that I can pay without being redirected away.
2. As a customer, I want to pay with my card or bank transfer via Paystack, so that I am not required to have an M-Pesa account.
3. As a customer, I want to see a "processing payment" state while my payment is being verified, so that I know the system is working.
4. As a customer, I want internet access to be granted automatically within seconds of a successful payment, so that I do not have to do anything extra.
5. As a customer, I want to see a clear success message with my session details (plan name, expiry time) after payment, so that I know when my session will end.
6. As a customer, I want to see a clear error message if my payment fails or is cancelled, so that I can try again without confusion.
7. As a customer, I want my payment to be linked to my phone number (used for registration), so that my session history is tracked correctly.
8. As a customer, I want the amount I pay to match the plan price exactly as shown on the portal, so that there are no surprises.
9. As an admin, I want completed Paystack payments to appear in the payment history with a paymentReference (Paystack reference), so that I can reconcile transactions.
10. As an admin, I want failed or abandoned payments to be marked FAILED in the database, so that the records are accurate.
11. As an admin, I want the payment currency to be NGN (Nigerian Naira), consistent with the business Paystack account configuration.
12. As an admin, I want all payment verification to happen server-side (via webhook), so that payment status cannot be spoofed from the frontend.
13. As a developer, I want the Paystack secret key to be configurable via environment variable, so that sandbox and production keys can be swapped without code changes.
14. As a developer, I want all Paystack HTTP calls to use raw fetch, so that no additional SDK dependency is introduced.
15. As a developer, I want the webhook endpoint to verify the Paystack HMAC-SHA512 signature, so that only genuine Paystack events update payment records.

## Implementation Decisions

### Payment service module

- A new PaystackService module replaces MpesaService entirely.
- The module exposes three public operations:
  - initiateTransaction(email, amount, planId, paymentId) — calls the Paystack Initialize Transaction API, returns the access_code and reference to the frontend.
  - verifyTransaction(reference) — calls the Paystack Verify Transaction API, returns the transaction status and amount.
  - handleWebhook(rawBody, signature) — verifies the HMAC-SHA512 signature using PAYSTACK_SECRET_KEY, parses the charge.success event, updates the payment record to COMPLETED, and triggers session creation.
- All Paystack REST calls use fetch with Authorization: Bearer <PAYSTACK_SECRET_KEY>.
- Base URL is https://api.paystack.co.
- Amounts sent to Paystack are Math.round(amount * 100) (kobo).

### Database schema

- The Payment model drops the mpesaReceiptNumber field.
- A new paymentReference field (String, nullable, unique) is added to store the Paystack transaction reference.
- The checkoutRequestId field stores the Paystack reference returned at transaction initialization (unique correlator for the pending payment).
- paymentMethod default value changes from "MPESA" to "PAYSTACK".
- A Prisma migration is generated and applied.

### Payment initialization flow

- The public route POST /api/public/payment no longer calls an STK Push.
- It calls paystackService.initiateTransaction(...) and returns { reference, access_code } to the frontend.
- The payment record is created in PENDING status with checkoutRequestId set to the Paystack reference.

### Webhook route

- A new route POST /api/public/payment/paystack/webhook replaces POST /api/public/payment/mpesa/callback.
- It passes the raw request body and the x-paystack-signature header to paystackService.handleWebhook(...).
- On a charge.success event with a matching pending payment, the payment is marked COMPLETED and a session is created.
- The route always responds 200 OK to Paystack regardless of internal errors.

### Payment status polling

- The existing GET /api/public/payment/status/:checkoutRequestId route is unchanged in shape; the :checkoutRequestId parameter now carries the Paystack reference.
- The frontend polls this endpoint at the same cadence as before.

### Frontend (Customer Portal)

- The Paystack Popup is loaded via the official Paystack inline script (https://js.paystack.co/v1/inline.js) added to index.html.
- When the customer clicks "Pay", the frontend calls POST /api/public/payment to get a reference and access_code, then opens the Paystack Popup.
- On popup onSuccess(transaction), the frontend begins polling GET /api/public/payment/status/:reference.
- On popup onClose, if payment is not yet confirmed, the frontend shows a "Payment cancelled" message.
- All M-Pesa-specific UI elements are removed.

### Environment variables

- MPESA_* variables are removed from .env.example.
- PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY are added.

## Testing Decisions

Good tests target the externally observable behaviour of PaystackService — what HTTP calls it makes and what it writes to the database — not internal implementation details.

### Seams to test

- PaystackService unit tests (primary seam):
  - initiateTransaction — mock fetch; assert correct payload (amount in kobo, NGN currency) and reference returned.
  - verifyTransaction — mock fetch; assert it calls the verify endpoint and returns parsed status.
  - handleWebhook — given valid HMAC-SHA512 signature + charge.success body, assert payment goes to COMPLETED and session is created. Given invalid signature, assert no DB writes.

- Route integration tests (secondary):
  - POST /api/public/payment — assert PENDING payment created and reference returned.
  - POST /api/public/payment/paystack/webhook — assert charge.success flips payment to COMPLETED.
  - GET /api/public/payment/status/:reference — assert status "completed" + sessionToken when COMPLETED.

### Prior art

No existing test suite found. The NODE_ENV === "development" mock branch in mpesaService.ts (setTimeout simulation) can be used as a pattern for a dev-mode stub in paystackService.ts while real tests are written separately.

## Out of Scope

- Mobile money / USSD channels via Paystack.
- Keeping M-Pesa as a fallback or alternative.
- Paystack recurring charges or subscription billing.
- Refund flows.
- Multi-currency support (NGN only).
- Frontend end-to-end tests.
- Admin dashboard UI changes beyond the paymentReference field rename.

## Further Notes

- Paystack Popup v1 (inline.js) is synchronous on the frontend; no async loading logic needed beyond a script tag.
- The webhook URL must be registered in the Paystack dashboard under Settings -> API Keys & Webhooks.
- During local development, ngrok or Paystack test mode with manual verifyTransaction can simulate the webhook.
- The Paystack reference is globally unique per transaction and safe to use as the payment correlator.
