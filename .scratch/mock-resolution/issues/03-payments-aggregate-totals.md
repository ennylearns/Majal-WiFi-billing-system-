# 03: Payments aggregate totals

**What to build:** Extend `GET /api/admin/payments` to return all-time aggregate totals — total revenue (sum of all payment amounts), total payment count, pending count, and failed count — alongside the existing paginated results and pagination metadata. Totals are computed at the database level, not in application code. On the frontend, the four summary KPI cards (Total Revenue, Total Payments, Pending, Failed) on the Payments page read from the response totals rather than reducing over the current paginated slice. Remove the "Export Report" button.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `GET /api/admin/payments` response includes a `totals` object: `{ revenue: number, count: number, pending: number, failed: number }`
- [ ] Totals are all-time (not filtered by the current page's date range or cursor)
- [ ] Totals are computed via database aggregation, not `Array.reduce` in the handler
- [ ] Payments page KPI cards read from `response.totals`, not `payments.reduce(...)`
- [ ] "Export Report" button is removed from the Payments page
- [ ] Test: payments list response includes correct `totals` for a seeded set of payments in various statuses (using the in-memory stub pattern from `paymentService.test.ts`)
