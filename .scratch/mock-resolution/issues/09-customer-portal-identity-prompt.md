# 09: Customer portal identity prompt

**What to build:** Before the Paystack payment popup launches, the Customer Portal presents a small form collecting the guest's phone number and email address. If phone or email are already present in the URL query parameters (captive portal handoff), those fields are pre-populated and the prompt is skipped or shortened. The collected email replaces the hardcoded `customer@collospot.com` passed to the Paystack popup config. Phone and email are stored on the session record on fulfillment. `publicAPI.register` and `publicAPI.login` are marked with a `// TODO (future)` comment and not wired to any UI.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A phone + email collection form is shown before the Paystack popup for any guest whose contact details are not already in the URL params
- [ ] If `phone` and `email` are present in URL query params, the upfront form is skipped and those values are used directly
- [ ] The collected email is passed to the Paystack popup `customer.email` field, replacing the hardcoded value
- [ ] The collected phone number is passed to the Paystack popup `customer.phone` field
- [ ] Phone and email are included in the fulfillment payload sent to the backend when the payment settles
- [ ] Backend stores phone and email on the session record on fulfillment
- [ ] The form validates that phone and email are non-empty before allowing progression
- [ ] `publicAPI.register` and `publicAPI.login` are marked `// TODO (future)` and have no UI entry point
