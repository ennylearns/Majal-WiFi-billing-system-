# 02: PaystackService Module

**What to build:** A new backend payment service that handles all communication with the Paystack API, replacing the M-Pesa service entirely. This is the single seam through which all payment logic flows.

**Blocked by:** 01 (DB Schema Migration)

**Status:** ready-for-agent

- [ ] Create a `PaystackService` that exposes three public operations:
  - `initiateTransaction(email, amount, planId, paymentId)` — calls the Paystack Initialize Transaction API (`POST https://api.paystack.co/transaction/initialize`), returns `{ reference, access_code }`
  - `verifyTransaction(reference)` — calls the Paystack Verify Transaction API (`GET https://api.paystack.co/transaction/verify/:reference`), returns `{ status, amount }`
  - `handleWebhook(rawBody, signature)` — verifies the HMAC-SHA512 signature using `PAYSTACK_SECRET_KEY`; on a `charge.success` event, updates the matching payment record to `COMPLETED` and creates an internet session for the user
- [ ] All Paystack REST calls use raw `fetch` with `Authorization: Bearer <PAYSTACK_SECRET_KEY>`
- [ ] Amounts sent to Paystack are `Math.round(amount * 100)` (kobo), currency `NGN`
- [ ] A dev-mode stub exists (when `NODE_ENV === 'development'`) that skips real API calls and simulates a successful payment after a short delay, so local development works without real Paystack credentials
- [ ] `mpesaService.ts` is deleted
- [ ] Webhook signature verification rejects invalid signatures without touching the database
