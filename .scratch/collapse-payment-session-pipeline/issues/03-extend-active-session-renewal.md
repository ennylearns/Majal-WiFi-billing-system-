# 03: Extend active session expiration on renewal payment

**What to build:** When a customer who already possesses an active session completes a payment for plan renewal, extend the existing session's expiration timestamp by the duration of the purchased plan rather than attempting duplicate session creation or router user conflicts.

**Blocked by:** 02: Direct session and MikroTik user provisioning on payment webhook

**Status:** ready-for-agent

- [ ] Webhook fulfillment detects when an active session already exists for the customer.
- [ ] If an active session exists, its expiration time is extended by the purchased plan's duration hours.
- [ ] No duplicate session database row is created when renewing an active session.
- [ ] No redundant or conflicting hotspot user creation request is dispatched to the router for an already active session token.
- [ ] Unit tests verify that active session expiration timestamps are updated correctly upon renewal payments.
