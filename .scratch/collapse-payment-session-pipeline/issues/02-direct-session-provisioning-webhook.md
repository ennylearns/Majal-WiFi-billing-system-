# 02: Direct session and MikroTik user provisioning on payment webhook

**What to build:** Route successful payment webhook fulfillment directly through the session service so that whenever a payment is confirmed for a user without an active session, both the database session record and the MikroTik router hotspot user profile & credentials are created. Handle repeated/duplicate webhook events idempotently.

**Blocked by:** 01: Inject SessionService into PaystackService

**Status:** done
 
- [x] Successful payment webhook events delegate session creation to the session service when no active session exists.
- [x] MikroTik router hotspot user credentials matching the session token are created on the target router upon webhook processing.
- [x] Completed payment records store the payment reference and mark status as completed.
- [x] Webhook deliveries for payments that are already marked completed act as idempotent no-ops and avoid duplicate session creation.
- [x] Unit tests verify that the session service is invoked with the expected user identifier, plan identifier, and generated session token upon valid charge success.
