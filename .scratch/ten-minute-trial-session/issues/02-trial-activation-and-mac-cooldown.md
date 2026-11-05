# 02: 10-Minute Trial Activation with 24-Hour MAC Cooldown

**What to build:**
An unauthenticated visitor on the captive portal can click a single button to activate a 10-minute free trial connection. The backend verifies that the device's MAC address has not used a trial within the last 24 hours, creates a trial session record in the database, and provisions a temporary Hotspot user on the target MikroTik router configured with a 2M/1M rate limit and a 10-minute session-timeout. If the MAC address has already claimed a trial within the past 24 hours, the request is rejected with a cooldown message and the remaining time until next trial eligibility.

**Blocked by:** 01: Captive Portal Client MAC & IP Parameter Forwarding

**Status:** done

- [x] Database schema and session service support recording trial sessions linked to device MAC address, router, and expiration time.
- [x] Public API endpoint `POST /api/public/trial/start` accepts `routerId`, `macAddress`, and optional `ipAddress`.
- [x] Backend validates that no trial session for the given `macAddress` was started within the preceding 24 hours; rejects with HTTP 429/400 and hours/minutes remaining if cooldown is active.
- [x] Eligible trial requests provision a MikroTik hotspot user assigned to a profile with `rate-limit=2M/1M` and `session-timeout=10m`.
- [x] RouterOS automatically logs out the user when the 10-minute session-timeout expires.
- [x] Public API endpoint `GET /api/public/trial/status` reports whether a given MAC is actively in a trial, eligible for a new trial, or in 24-hour cooldown.
- [x] Customer portal provides a clear "Connect 10 Mins Free" action that initiates the trial using the client's forwarded MAC address.
- [x] Automated tests verify successful trial provisioning, RouterOS timeout profile creation, and 24-hour cooldown rejection.

