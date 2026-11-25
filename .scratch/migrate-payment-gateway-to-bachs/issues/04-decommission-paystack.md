# 04: Decommission Paystack & Clean Up Dead Code

**What to build:** Removes all legacy Paystack service modules, Paystack gateway classes, Paystack webhook routes, and Paystack-specific test suites, and updates environment templates to Bachs configuration variables so the codebase is clean and the full test suite passes.

**Blocked by:** 03: Wire Payment Service & Mock Simulation

**Status:** ready-for-agent

- [ ] `PaystackGateway` and `paystackService` are deleted with no remaining imports or references in application code.
- [ ] Legacy `/payments/paystack/webhook` route is removed (hard cut).
- [ ] Legacy Paystack test files are removed and gateway test suites target `BachsGateway` only.
- [ ] Environment template replaces `PAYSTACK_SECRET_KEY` with `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, and optional `BACHS_PAYMENT_METHODS`.
- [ ] Full backend test suite and TypeScript build pass with zero errors.
