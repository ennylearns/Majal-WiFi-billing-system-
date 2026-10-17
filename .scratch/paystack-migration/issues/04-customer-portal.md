# 04: Customer Portal (Frontend)

**What to build:** Update the customer-facing captive portal to use the Paystack Popup for payments instead of M-Pesa STK Push. The customer selects a plan, a Paystack popup appears, and on success the portal polls for confirmation and grants internet access.

**Blocked by:** 03 (Backend Routes)

**Status:** ready-for-agent

- [ ] The official Paystack inline script (`https://js.paystack.co/v1/inline.js`) is added to `index.html`
- [ ] When the customer clicks "Pay", the portal calls `POST /api/public/payment` to obtain a `reference` and `access_code`, then immediately opens the Paystack Popup using those values and `VITE_PAYSTACK_PUBLIC_KEY`
- [ ] On popup `onSuccess(transaction)`, the portal begins polling `GET /api/public/payment/status/:reference` at the same cadence as before; on confirmed status it displays a success screen with plan name and session expiry
- [ ] On popup `onClose` (without confirmed payment), the portal shows a "Payment cancelled — try again" message
- [ ] All M-Pesa-specific UI elements are removed: STK Push prompt, "Check your phone" message, phone-number-for-payment field, and any M-Pesa branding
- [ ] `VITE_PAYSTACK_PUBLIC_KEY` is used for the popup initialisation (sourced from `.env`)
- [ ] The full payment-to-connection flow completes in Paystack test mode without errors
