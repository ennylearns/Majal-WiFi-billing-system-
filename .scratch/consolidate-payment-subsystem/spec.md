# Consolidate Payment Subsystem

Status: ready-for-agent

## Problem Statement

Payment responsibilities are fragmented across public guest routes, authenticated customer routes, administrator endpoints, and low-level third-party integration code. Domain rules—such as guest account provisioning, pending payment record creation, and fulfillment fallback during status polling—are directly embedded within Express route controllers rather than encapsulated inside a dedicated payment service. Furthermore, payment fulfillment logic is duplicated between webhook handlers and status polling routes, causing potential race conditions and inconsistent session provisioning. Testing payment workflows currently requires fragile HTTP routing harnesses and deep database mocks rather than clean service-level test seams.

## Solution

Consolidate all payment lifecycle operations into a unified, deep payment service that encapsulates transaction initiation, idempotent fulfillment, status verification, webhook event processing, and reporting queries behind a minimal, cohesive interface. The payment service interacts with external payment infrastructure through a standardized payment gateway adapter interface, completely decoupling core payment invariants from third-party vendor APIs. All payment HTTP routing is unified into a cohesive payments router adapter that preserves external URL contracts for captive portals, customer dashboards, administrative interfaces, and external webhook deliveries while delegating all business logic to the payment service.

## User Stories

1. As a captive portal visitor, I want to initiate a payment for an internet plan using my phone number or email, so that I can purchase connectivity without creating an account upfront.
2. As a captive portal visitor, I want an automatic guest customer record provisioned if I don't already have one, so that my payment and subsequent access session are properly associated with my identity.
3. As a captive portal visitor, I want a secure checkout authorization URL and transaction reference returned, so that I can complete payment through the payment gateway.
4. As a captive portal visitor, I want to poll my payment status using my checkout reference, so that my device is granted internet access immediately once the transaction settles.
5. As a captive portal visitor, I want payment fulfillment to activate my internet session idempotently, so that concurrent status polling and webhook events never create duplicate sessions or double-charge my time.
6. As a captive portal visitor, I want an SMS confirmation sent upon successful payment fulfillment, so that I have a receipt of my transaction and access plan details.
7. As an authenticated customer, I want to retrieve my historical payment transactions, so that I can review my previous WiFi purchases.
8. As an authenticated customer, I want to view detailed information for a specific past payment, so that I can verify the plan, amount, and timestamp.
9. As an authenticated customer, I want my payment history scoped strictly to my own account, so that other users cannot inspect my transaction records.
10. As a network administrator, I want to query a paginated list of all payments with filtering by status, date range, and user details, so that I can audit revenue and assist customers with billing inquiries.
11. As a third-party payment gateway, I want to deliver webhook notifications to a persistent, documented webhook endpoint, so that payment events are received reliably without reconfiguration.
12. As a security engineer, I want incoming payment webhooks cryptographically verified against a shared secret using raw request payload signatures, so that forged payment notifications are rejected before any database or session state is modified.
13. As a platform developer, I want the payment service to accept a payment gateway adapter at its boundary, so that I can test payment workflows using fast in-memory fakes without hitting external gateway APIs or monkey-patching HTTP libraries.
14. As a platform developer, I want all payment database queries encapsulated inside the payment service, so that database schema changes do not require modifications across multiple route controller files.
15. As a platform developer, I want public HTTP payment endpoints to route to the consolidated payments router without breaking existing frontend client paths or captive portal links.
16. As a platform developer, I want payment status updates and session activations to execute in an atomic transaction, so that partial fulfillment states cannot occur during infrastructure failures.
17. As a finance auditor, I want payments to record exact gateway reference tokens, checkout request IDs, and plan pricing at the time of purchase, so that financial reconciliations remain accurate over time.

## Implementation Decisions

- **Deep Payment Service Interface**: Define a single payment service class acting as the primary domain module for all payment operations. The interface exposes small, cohesive methods: payment initiation, status verification and fulfillment, webhook ingestion, customer payment retrieval, and administrative payment queries.
- **Payment Gateway Seam**: Introduce a payment gateway adapter interface defining transaction initiation, remote transaction verification, and HMAC webhook signature validation. The existing vendor integration is adapted to satisfy this interface, enabling fake adapters to be injected during automated testing.
- **Unified Atomic Fulfillment**: Consolidate fulfillment logic—updating payment status to completed, creating active network sessions via the session service, and triggering notification messages via the SMS service—into a single atomic transaction. Status check polling and webhook handlers both call this unified fulfillment path. State transitions verify that payment status is currently pending before executing fulfillment, making duplicate calls idempotent.
- **Internalized Guest Resolution**: Payment initiation accepts contact details (phone, email) alongside plan identification and amount. The payment service internally resolves existing customer records or creates a guest customer within its initiation workflow, eliminating route-level customer record manipulation.
- **Administrative Payment Queries**: Encapsulate administrative payment listing, pagination, and multi-field filtering inside the payment service. Admin controller routes act as transport adapters that forward query parameters to the service and format JSON responses.
- **Route Locality with Contract Preservation**: Consolidate all payment route handling into a dedicated payments route module. To preserve external URL contracts required by the captive portal, frontend API clients, and pre-configured webhook URLs in vendor dashboards, the public routing tier delegates `/payment/*` requests to the payments route module rather than duplicating handler implementations.

## Testing Decisions

- **Testing Principles**: Tests must exercise external behavior through the module's interface rather than inspecting private internal properties or database queries directly.
- **Primary Seam**: The primary test seam is the payment service interface (`PaymentService`) invoked with an in-memory database or transactional test database fixture and a fake `PaymentGateway` adapter. This allows end-to-end verification of payment initiation, state progression, and fulfillment without external network dependencies.
- **Secondary Seam**: The HTTP route adapter seam tested via integration tests (using Supertest) to ensure request validation, parameter mapping, authentication guards, and response formatting behave correctly across all public, customer, and administrative endpoints.
- **Prior Art**: Follows the established test patterns in the session service tests (`backend/src/services/tests/sessionService.test.ts`) and route integration tests (`backend/src/routes/tests/`).

## Out of Scope

- Modifying frontend user interfaces or captive portal styling.
- Adding additional third-party payment gateways (e.g. MPesa direct, Stripe).
- Reworking session expiration or router credential provisioning logic inside the session service.
- Implementing an asynchronous background message queue (e.g. BullMQ / Redis) for webhook retries.

## Further Notes

- Existing registered webhook URLs in third-party dashboards (`/api/public/payment/paystack/webhook`) must continue resolving seamlessly through route forwarding.
- Aligns with ADR 0001 (`docs/adr/0001-consolidated-payment-service.md`) and terms defined in `GLOSSARY.md`.
