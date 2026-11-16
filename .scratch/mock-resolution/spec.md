# Spec: Mock Resolution & Admin UI Completion

Status: ready-for-agent

---

## Problem Statement

Large portions of the admin UI and customer portal present controls that appear functional but are entirely or partially disconnected from the backend. Hardcoded values, fake toast confirmations, dead buttons, and implicit mock fallbacks erode operator trust and create silent failure modes in production. Additionally, the Plan creation form does not expose router assignment, even though the backend enforces it as required.

---

## Solution

Systematically replace every mocked, hardcoded, or disconnected component with real behaviour, remove dead affordances that have no near-term spec, and gate backend mock fallbacks behind an explicit environment flag. The Plan creation and edit modal gains a router selector so operators can assign a Plan to a Router at creation time.

---

## User Stories

### Settings Page

1. As an admin, I want the Settings page to display the current environment configuration (business name, support email, Paystack webhook URL) in read-only fields, so that I can verify the deployment without accidentally mutating secrets.
2. As an admin, I want the Router tab in Settings to redirect me to the Routers management page, so that I manage routers in one place without a confusing duplicate form.
3. As an admin, I want the Security and Database tabs removed from Settings, so that I am not misled by placeholder content that has no backing implementation.
4. As an admin, I want all "Save" buttons removed from env-backed settings sections, so that the UI does not imply I can persist changes that are actually controlled by deployment config.

### Dashboard Overview

5. As an admin, I want the Infrastructure Status panel to show real health data for PostgreSQL, the Paystack payment gateway key, and WireGuard, so that I can spot infrastructure problems at a glance.
6. As an admin, I want the health check to tell me whether each service is reachable or misconfigured, so that I can act on the information without guessing.
7. As an admin, I want the fake "+12% this week" and "+8% vs last month" KPI badges removed, so that the dashboard does not display fabricated trend data.
8. As an admin, I want the non-functional "Export Log" and "Filter" buttons removed from the dashboard, so that the UI only shows controls that work.
9. As an admin, I want the "Issue Voucher" CTA removed, so that I am not directed to a feature that does not exist.

### Payments Management

10. As an admin, I want the Total Revenue, Total Payments, Pending, and Failed summary cards on the Payments page to reflect all-time database aggregates, so that the numbers are accurate regardless of which page of results I am viewing.
11. As an admin, I want the "Export Report" button removed until a CSV export endpoint is implemented, so that clicking it does not silently do nothing.

### Users Management

12. As an admin, I want a contextual action menu on each user row that lets me view that user's session history, so that I can audit their activity.
13. As an admin, I want the action menu to let me terminate a user's active sessions, so that I can revoke access immediately.
14. As an admin, I want the action menu to let me toggle a user's active/inactive status, so that I can ban or reinstate a user without deleting their record.
15. As an admin, I want the action menu to let me view a user's MAC address bindings, so that I can trace which devices they have used.
16. As an admin, I want the "Export Users" and "Filters" buttons removed until their backing implementation exists, so that the UI only shows working controls.

### Admin Dashboard Top Bar

17. As an admin, I want the global search input removed until it has a real implementation, so that the top bar does not contain a non-functional affordance.
18. As an admin, I want the notification bell removed until it is connected to real audit log or payment events, so that the static red dot does not create a false sense of pending alerts.

### Customer Portal

19. As a guest customer, I want to be prompted for my phone number and email address before the payment popup launches, so that my identity is captured independently of the payment gateway.
20. As a guest customer, I want my email pre-filled in the Paystack popup from what I entered in the prompt, so that I do not have to type it twice.
21. As an admin, I want the customer's phone and email stored against their session on fulfillment, so that I can contact them or look them up later.
22. As a guest customer arriving via captive portal with MAC and router parameters already in the URL, I want the upfront prompt to only ask for phone and email (not for details already known), so that the checkout flow is as short as possible.

### Backend Mock Fallbacks

23. As a developer, I want the Paystack mock fallback (which generates `mock_ref_...` references) to be gated behind a `MOCK_SERVICES=true` environment flag, so that a misconfigured production deployment fails fast with a clear error rather than silently processing fake payments.
24. As a developer, I want the WireGuard mock fallback to be gated behind the same `MOCK_SERVICES=true` flag, so that sessions are never provisioned against a fake WireGuard in production.
25. As a developer, I want the application to log a clear error and refuse to start if `PAYSTACK_SECRET_KEY` is unset and `MOCK_SERVICES` is not `true`, so that the failure is obvious and actionable.

### Plan–Router Assignment

26. As an admin, I want to select which Router a Plan belongs to when I create or edit the plan, so that sessions provisioned under that plan are routed through the correct network gateway.
27. As an admin, I want the router selector in the Plan form to list routers by name and location, so that I can identify the right gateway without knowing its internal ID.
28. As an admin, I want the "Advanced Settings" section replaced by the Router selector in the Plan creation and edit modal, so that the form is not cluttered with redundant controls.
29. As an admin, I want the Plan creation form to prevent submission if no router is selected, consistent with the backend's existing validation.

---

## Implementation Decisions

### Settings Page
- All settings values are sourced from environment variables; no `SystemSetting` database model is introduced.
- The General, Paystack, and Notifications tabs become read-only displays of env var values. All "Save" buttons are removed.
- The Router tab body is replaced with a navigational card linking to the Routers management route. The `settings.router.*` local state and `renderRouterSettings` form are deleted.
- The Security and Database tabs and their corresponding tab entries are deleted entirely.

### Dashboard Health Check
- A new `GET /api/admin/health` endpoint is introduced on the backend.
- It checks three things: (a) PostgreSQL reachability via a lightweight Prisma query, (b) Paystack key presence (`!!process.env.PAYSTACK_SECRET_KEY`), (c) WireGuard availability (`wg show` exit code).
- Each check returns a status of `ok` or `error` with an optional message. RouterOS reachability is explicitly out of scope.
- The Infrastructure Status table in DashboardOverview fetches from this endpoint and renders live status rows instead of the hardcoded list.
- The `+12% this week` and `+8% vs last month` trend badges are deleted. No historical comparison query is introduced.
- The "Export Log", "Filter", and "Issue Voucher" controls are removed.

### Payments Aggregate Totals
- `GET /api/admin/payments` returns aggregate totals (all-time total revenue, total payment count, pending count, failed count) alongside the existing pagination metadata.
- Totals are computed at the database level (Prisma `aggregate`/`groupBy`), not in application code.
- The Payments page reads totals from the response metadata rather than reducing over the current paginated slice.
- The "Export Report" button is removed.

### User Action Menu
- The `MoreVertical` button on each user row opens a dropdown or drawer with four actions: View Session History, Terminate Active Sessions, Toggle Active/Inactive, View MAC Bindings.
- Each action calls a dedicated admin API endpoint. No new Prisma models are needed; all data is already modelled (`Session`, `MacBinding`, `User.isActive`).
- The "Export Users" and "Filters" buttons are removed.

### Admin Dashboard Top Bar
- The global search input is removed from the DOM entirely.
- The notification bell icon and its static red indicator dot are removed.

### Customer Portal Identity Capture
- Before launching the Paystack popup, the portal presents a small form collecting phone number and email.
- If phone or email are already present in the URL query parameters (captive portal handoff), those fields are pre-populated and the prompt is skipped or shortened accordingly.
- The collected email replaces the hardcoded `customer@collospot.com` passed to the Paystack popup.
- Phone and email are stored on the session record on fulfillment.
- No customer login, registration, or self-service dashboard is introduced in this release. `publicAPI.register` and `publicAPI.login` are marked with a `// TODO (future)` comment and not wired to any UI.

### Backend Mock Fallback Guard
- Both the Paystack mock and the WireGuard mock check `process.env.MOCK_SERVICES === 'true'` before activating.
- If the flag is absent and the real dependency is not configured, the service throws an error at the point of use (startup check or first call) with a message identifying the missing configuration.
- Local development and CI set `MOCK_SERVICES=true` explicitly in their env files.

### Plan–Router Assignment
- `routerId` already exists as an optional field on the `Plan` model and is validated as required by the backend create route. No schema migration is needed.
- `adminAPI.getRouters()` already exists on the frontend API service. The Plan modal calls it on mount and stores the router list in local state.
- The "Advanced Settings" collapsible section in the Plan modal is replaced with a required `<select>` field labelled "Router", populated from the fetched router list with each option showing `{name} — {location}`.
- `routerId` is added to `formData` initial state (empty string) and included in the `planData` object sent on submit for both create and edit.
- The form's submit button is disabled while routers are loading.

---

## Testing Decisions

- Tests should verify observable behaviour at the highest available seam: HTTP handler responses for backend changes, and service-level unit tests for the health check and mock-guard logic.
- Good tests for the health endpoint: assert that each service's status field is `ok` when the dependency is healthy and `error` when it is not, using stubs for Prisma/`wg`/env — do not test the internal ping implementation.
- Good tests for the mock guard: assert that instantiating `PaystackService` or `WireguardService` without `MOCK_SERVICES=true` and without the real key/binary throws a descriptive error.
- Good tests for payments aggregate totals: assert that the payments list response includes a `totals` object with `revenue`, `count`, `pending`, `failed` fields — use the existing in-memory Prisma stub pattern from `paymentService.test.ts`.
- Prior art: `paymentService.test.ts`, `paystackService.test.ts`, `wireguardService.test.ts`, `sessionService.test.ts` all use the in-memory stub + `node:test` + `assert/strict` pattern and should be followed.
- Frontend behaviour (router dropdown populated, form blocks submission without router, portal prompt collects phone+email) is out of scope for automated tests in this release; manual smoke testing is sufficient.

---

## Out of Scope

- Historical KPI trend comparisons (week-over-week, month-over-month) on the dashboard.
- CSV export for payments or users.
- Global search across users, routers, and payments.
- Notification feed connected to audit logs or payment events.
- Voucher / coupon provisioning.
- Customer self-service dashboard (login, session history, receipts).
- RouterOS reachability check in the health endpoint.
- Security and Database settings implementations.
- Filter by user status in Users Management.

---

## Further Notes

- The implementation order that minimises integration risk: backend mock guards → health endpoint → payments aggregates → user action endpoints → frontend Settings cleanup → frontend Dashboard cleanup → frontend Payments cleanup → frontend Users cleanup → frontend top-bar cleanup → frontend Customer Portal prompt → frontend Plan router selector.
- The Plan router selector is a frontend-only change; the backend already enforces `routerId` as required, so any Plan created today without it fails at the API layer.
