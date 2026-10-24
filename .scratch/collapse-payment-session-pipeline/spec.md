# Collapse Payment-to-Session Pipeline

Status: ready-for-agent

## Problem Statement

When customers complete payments via Paystack for hotspot plans, the payment webhook creates session database records directly through raw database queries rather than invoking the session management service. Consequently, hotspot user credentials and bandwidth profiles are never created on the physical MikroTik router for sessions originating from webhooks. When customers attempt to authenticate against the captive portal using their session credentials, authentication fails and internet access is denied despite successful payment. Additionally, renewal payments for users with active sessions do not extend existing access durations and duplicate webhook events risk creating inconsistent session states.

## Solution

Unify the payment fulfillment pipeline by delegating session provisioning directly from the payment webhook handler to the session service. When a successful payment webhook is processed, the system checks whether an active session already exists for the customer:
1. If an active session exists, the session duration is extended by the purchased plan duration.
2. If no active session exists, a new session is provisioned through the session management service, establishing both the database session and the corresponding hotspot user credentials on the target MikroTik router.
3. If router communication encounters network or device errors during provisioning, the payment status remains completed, and the error is logged and flagged for recovery rather than rejecting the payment processor webhook.
4. Duplicate webhook deliveries for already completed payments are handled idempotently.

## User Stories

1. As a hotspot customer, I want my internet access immediately activated upon successful payment, so that I can browse without manual administrator intervention.
2. As a hotspot customer, I want my hotspot login credentials to exist on the MikroTik router right after payment, so that captive portal login succeeds without credential errors.
3. As a hotspot customer, I want my active session duration extended when purchasing additional time, so that I do not lose unused access time.
4. As a hotspot customer, I want uninterrupted connectivity during session renewal, so that my existing active connection remains valid with updated expiration.
5. As a network operator, I want all session creations to route through the centralized session service, so that router configuration and database state remain in sync.
6. As a network operator, I want payments marked as completed even if a router is temporarily unreachable, so that paying customers' transactions are not rejected or retried destructively by the payment processor.
7. As a network operator, I want failed router provisioning attempts during webhook processing logged clearly, so that automated retries or support staff can provision missing router credentials.
8. As a platform developer, I want the payment service to accept an injected session service instance, so that webhook processing and provisioning can be tested reliably in isolation.
9. As a platform developer, I want duplicate webhook notifications from the payment gateway to be idempotent, so that duplicate sessions or conflicting expiration records are avoided.
10. As a captive portal visitor polling payment status, I want consistent session token delivery whether provisioned by webhook or polling fallback, so that my device connects cleanly.
11. As a finance administrator, I want payment references and gateway transaction identifiers accurately recorded on completed payments, so that audit logs match payment provider statements.
12. As a network operator, I want bandwidth profiles and speed limits correctly configured on the router when a webhook provisions a session, so that quality of service guarantees are maintained.
13. As a network administrator, I want sessions to accurately reference the specific router hosting the plan, so that termination and cleanup jobs target the correct physical device.
14. As an automated maintenance job, I want sessions provisioned via webhooks to have valid expiration timestamps, so that expired sessions are cleanly reaped from both the database and the router.

## Implementation Decisions

- **Direct Service Delegation**: The payment service's webhook handler delegates session fulfillment directly to the session management service rather than writing raw database session records directly.
- **Session Extension vs. New Session**: When processing a successful charge for a user who already possesses an active session for the plan's service, the system extends the existing session's expiration timestamp by the purchased plan duration. If no active session exists, a new session is initiated with credentials provisioned on the router.
- **Fault-Tolerant Router Provisioning**: Payments confirmed by the payment gateway must be marked as completed regardless of downstream router availability. Any errors arising from router communication during hotspot user creation are trapped and logged with diagnostic context, preventing HTTP 500 responses to the webhook sender for verified payments.
- **Idempotency Guarantee**: If a webhook event is received for a payment that is already marked as completed, the handler treats the call as an idempotent no-op and returns success without attempting duplicate session creation.
- **Dependency Injection for Testing**: The payment service constructor accepts an optional session service instance with fallback to the default singleton, enabling modular testing and seam isolation without global mocking.
- **Decoupled Architecture**: Logic specific to payment verification and payment record updating remains within the payment service, while session lifecycles, router credential generation, and profile assignments remain encapsulated within the session service.

## Testing Decisions

- **Testing Principles**: Tests must exercise public external behavior through module interfaces rather than inspecting internal query implementations or private properties.
- **Primary Seam**: The primary test seam is the webhook handler interface `handleWebhook(payload, signature)` in the payment service, executed with test database fixtures and mock session service implementations.
- **Test Scenarios**:
  1. *Fresh Session Fulfillment*: Verifies that a valid payment webhook for a pending payment without an active session updates payment status to completed and invokes the session service to create a session and router credentials.
  2. *Active Session Extension*: Verifies that a valid payment webhook for a user with an active session extends the existing session expiration time instead of creating duplicate sessions.
  3. *Downstream Failure Resilience*: Verifies that when the session service or router raises a connection exception, the payment record is still preserved as completed and the webhook handler exits cleanly without bubbling an unhandled exception.
  4. *Webhook Idempotency*: Verifies that submitting an identical webhook event multiple times does not trigger repeated session activations or database duplication.
  5. *Invalid Signature Rejection*: Verifies that tampered payloads or invalid HMAC signatures are rejected immediately prior to any database queries or session actions.
- **Prior Art**: Follows existing pattern in `paystackService.test.ts` where cryptographic signature verification, mock responses, and status assertions are performed using Node test runner.

## Out of Scope

- Migrating existing legacy database sessions created before this fix that lack router credentials.
- Automatic background retry queue infrastructure (e.g. BullMQ / Redis) for delayed router provisioning; error logging and exception containment are provided in this phase.
- Frontend payment portal UI adjustments.
- Modification of payment provider integration from Paystack to alternative gateways.

## Further Notes

- In local development mode, simulated webhook timers should exercise this identical unified flow to ensure development behavior matches production payment callbacks.
