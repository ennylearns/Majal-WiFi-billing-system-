# 04: Seamless In-Session Payment Upgrade to Paid Plan

**What to build:**
When a user currently on an active 10-minute trial purchases a paid plan, the payment fulfillment pipeline immediately transitions the active trial session into the purchased paid plan. The router profile and session expiration are updated to the paid plan's speed and duration without disconnecting the device or forcing the user to log in again with new credentials. The portal UI immediately transitions from the trial countdown to the paid plan active status.

**Blocked by:** 02: 10-Minute Trial Activation with 24-Hour MAC Cooldown

**Status:** ready-for-agent

- [ ] Payment fulfillment handler detects when a paying user/MAC has an active trial session.
- [ ] Active trial session is upgraded to the purchased plan duration (measured from payment time) and marked with paid plan status.
- [ ] Hotspot user credentials and profile on the MikroTik router are updated to match the purchased plan's bandwidth rate limit and session duration without tearing down the existing physical connection.
- [ ] Portal UI dismisses the trial countdown banner and displays active paid plan connection details.
- [ ] Automated tests verify that completing a payment during an active trial upgrades the session and router settings seamlessly without creating duplicate or conflicting sessions.

