# 03: Backend Routes

**What to build:** Update the backend API so that payment endpoints call Paystack instead of M-Pesa, and a new webhook endpoint receives Paystack payment confirmations.

**Blocked by:** 02 (PaystackService Module)

**Status:** completed

- [x] `POST /api/public/payment` calls `paystackService.initiateTransaction(...)` and returns `{ reference, access_code }` to the caller; it no longer initiates an STK Push
- [x] Payment record is created in `PENDING` status with `checkoutRequestId` set to the Paystack `reference`
- [x] `POST /api/public/payment/paystack/webhook` is added; it passes the raw body and `x-paystack-signature` header to `paystackService.handleWebhook(...)`; always responds `200 OK`
- [x] `POST /api/public/payment/mpesa/callback` route is removed
- [x] `GET /api/public/payment/status/:checkoutRequestId` continues to work unchanged in shape — `:checkoutRequestId` now carries the Paystack reference
- [x] `.env.example` removes all `MPESA_*` variables and adds `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`
- [x] Hitting `POST /api/public/payment` in dev mode returns a `reference` string without errors
