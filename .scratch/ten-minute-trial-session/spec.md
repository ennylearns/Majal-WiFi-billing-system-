# Ten-Minute Pre-Payment Grace Period / Trial Connection

Status: ready-for-agent

## Problem Statement

Users connecting to the captive portal WiFi hotspot must pay before receiving any internet access. First-time visitors and prospective customers cannot test network quality, may lack immediate local mobile data to load payment verification webhooks/pages, and experience friction before committing payment. There is currently no mechanism allowing unauthenticated users a short, time-limited grace period (10 minutes) to test connectivity and initiate payment before being disconnected.

## Solution

Provide a 10-minute free trial connection directly from the customer portal before requiring payment:
1. One-click trial activation on the captive portal page.
2. Abuse prevention by recording and enforcing a 24-hour cooldown per device MAC address.
3. MikroTik router enforcement: creates a temporary Hotspot user with a restricted speed profile (2M/1M) and an automatic 10-minute session-timeout in RouterOS.
4. If the user completes payment during the 10-minute trial, the system immediately and seamlessly upgrades their session to the purchased paid plan without dropping connection or requiring re-authentication.
5. If the 10 minutes elapse without payment, MikroTik automatically disconnects the host, and subsequent HTTP requests redirect back to the captive portal to prompt plan selection.
6. The portal displays a sticky countdown timer (`MM:SS`) and prompt to buy a plan to avoid disconnection.

## User Stories

1. As an unauthenticated hotspot visitor, I want to activate a 10-minute free connection with a single click on the captive portal, so that I can test the WiFi speed before paying.
2. As a hotspot visitor, I want my device MAC address automatically captured from the portal redirect URL, so that I don't need to manually find or type my MAC address.
3. As a trial user, I want to see a live countdown of my remaining trial minutes on the portal, so that I know exactly when my connection will expire.
4. As a trial user, I want a direct link or button to purchase a plan displayed prominently during my trial, so that I can pay without losing connection.
5. As a trial user, I want my connection seamlessly upgraded to my purchased plan when I pay during the trial, so that I do not experience drops or need to log in again.
6. As a trial user, I want my internet access disconnected automatically when the 10 minutes expire without payment, so that free access is strictly bounded.
7. As an expired trial user, I want to be redirected back to the captive portal when my trial ends, so that I can easily choose and purchase a paid plan.
8. As a hotspot operator, I want to restrict trial connections to 1 trial per device MAC address per 24 hours, so that users cannot abuse the network with infinite reconnects.
9. As a hotspot operator, I want trial users throttled to a conservative speed limit (2M/1M), so that free users do not congest bandwidth for paying customers.
10. As a hotspot operator, I want the 10-minute timeout enforced natively on the MikroTik router via session-timeout, so that disconnects happen accurately even if the billing server is temporarily busy.
11. As a network administrator, I want trial sessions recorded in the database with timestamps and status, so that trial usage and conversion rates can be monitored.
12. As a platform developer, I want an HTTP endpoint to request trial activation and check trial eligibility by MAC, so that the frontend can display appropriate UI states.
13. As a platform developer, I want RouterOS provisioning templates to forward client MAC and IP in redirect parameters, so that the portal receives valid client identifiers.
14. As a platform developer, I want the trial creation and payment upgrade logic covered by automated tests, so that regressions are caught early.

## Implementation Decisions

- **Client Identifier Capture**: The RouterOS provisioning script captive portal `login.html` template forwards MikroTik runtime variables `mac=$(mac)` and `ip=$(ip)` alongside `routerId` and `router=$(identity)` into query parameters.
- **Trial Request Seam (Public API)**: A dedicated public endpoint `POST /api/public/trial/start` accepting `{ routerId, macAddress, ipAddress }` validates eligibility against database records. If eligible, it records a trial session and provisions MikroTik credentials; if in cooldown, it returns HTTP 429 / 400 with remaining cooldown time.
- **Trial Status Endpoint**: `GET /api/public/trial/status?mac=...&routerId=...` allows the portal to check whether the current device is currently on an active trial, has an active paid plan, or is in cooldown.
- **24-Hour Cooldown Enforcement**: Database queries check for any trial session with the same `macAddress` created within the past 24 hours (`startTime > now - 24 hours`).
- **MikroTik Trial Profile & Session Timeout**: A dedicated MikroTik hotspot user profile `trial_profile` is configured with `rate-limit=2M/1M` and `session-timeout=10m`. The trial hotspot user is created with matching username/password token and assigned to `trial_profile`.
- **Automatic Disconnection**: RouterOS handles session expiration natively via `session-timeout=10m`, dropping the host from active hotspot users upon expiry and redirecting further traffic to captive portal.
- **Seamless Upgrade on Payment**: When `paymentService.handleWebhook` or `verifyAndFulfillPayment` fulfills a payment for a user/MAC with an active trial session, the trial session is transitioned to converted/upgraded, and the MikroTik user credentials/profile are updated or replaced with the purchased plan's duration and speed profile without disconnecting the client.
- **Sticky UI Timer & CTA**: The customer portal UI checks trial status from URL parameters and local storage; if a trial is active, it renders a sticky top banner with real-time countdown (`MM:SS`) and an immediate "Upgrade / Pay Now" button.

## Testing Decisions

- **Testing Principles**: Only test observable external behavior through API endpoints and service interfaces; avoid asserting internal implementation details.
- **Primary Seam**: The highest single test seam is the public HTTP route `POST /api/public/trial/start` and `GET /api/public/trial/status`, tested using Express test runner harness with mock MikroTik service.
- **Payment Upgrade Seam**: Test `handleWebhook` or payment fulfillment when an active trial session exists for the user/MAC, verifying seamless transition to the paid plan.
- **Test Scenarios**:
  1. *First-time trial request*: returns 200 with session token, end time (+10 min), and provisions trial user on router with 10-minute limit.
  2. *Duplicate trial within 24h*: returns rejection/cooldown response without provisioning router.
  3. *Payment during trial*: verifies existing trial session is upgraded to paid plan duration and speed profile.
  4. *Status check endpoint*: correctly reports whether MAC is active, eligible, or in cooldown.
- **Prior Art**: Follows patterns established in `backend/src/routes/tests/public.test.ts` and `backend/src/services/tests/sessionService.test.ts`.

## Out of Scope

- SMS OTP verification for trial access (one-click MAC tracking is used).
- Admin dashboard UI for custom per-router trial duration configuration (fixed at 10 minutes and 2M/1M).
- Hardware MAC randomization bypass prevention beyond standard MAC address logging.
- Multi-device shared trial accounts.

## Further Notes

- RouterOS v7 hotspot `session-timeout` applies directly to the user profile or user record.
- In local development mode without a connected physical router, mock/stub MikroTik responses allow full testing of trial session lifecycles.

