# 04: Fault-tolerant router provisioning in payment webhook

**What to build:** Ensure that if downstream router communication fails (network timeout, device unreachable, or authentication error) during session provisioning, the payment record is still preserved as completed and the error is trapped and logged rather than causing an unhandled webhook crash or payment rejection.

**Blocked by:** 02: Direct session and MikroTik user provisioning on payment webhook

**Status:** ready-for-agent

- [ ] Downstream exceptions thrown during router hotspot user provisioning are caught and logged with error details.
- [ ] Payment status remains completed regardless of downstream router provisioning errors so paying customers are not marked as unpaid.
- [ ] Webhook handler returns cleanly with HTTP success to prevent endless retry loops from the payment provider.
- [ ] Unit tests verify that when router provisioning throws, payment remains completed and no unhandled promise rejection escapes the webhook handler.
