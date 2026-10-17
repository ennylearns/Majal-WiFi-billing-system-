# 03: Backend Routes

**What to build:** Update the backend API so that payment endpoints call Paystack instead of M-Pesa, and a new webhook endpoint receives Paystack payment confirmations.

**Blocked by:** 02 (PaystackService Module)

**Status:** ready-for-agent

- [ ] `POST /api/public/payment` calls `paystackService.initiateTransaction(...)` and returns `{ reference, access_code }` to the caller; it no longer initiates an STK Push
- [ ] Payment record is created in `PENDING` status with `checkoutRequestId` set to the Paystack `reference`
- [ ] `POST /api/public/payment/paystack/webhook` is added; it passes the raw body and `x-paystack-signature` header to `paystackService.handleWebhook(...)`; always responds `200 OK`
- [ ] `POST /api/public/payment/mpesa/callback` route is removed
- [ ] `GET /api/public/payment/status/:checkoutRequestId` continues to work unchanged in shape — `:checkoutRequestId` now carries the Paystack reference
- [ ] `.env.example` removes all `MPESA_*` variables and adds `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`
- [ ] Hitting `POST /api/public/payment` in dev mode returns a `reference` string without errors
