# 06: Dashboard cleanup

**What to build:** Wire the Infrastructure Status table to the real health endpoint and strip all remaining dead UI from DashboardOverview. The fake "+12% this week" and "+8% vs last month" KPI trend badges are deleted. The "Export Log" and "Filter" action buttons are removed. The "Issue Voucher" CTA button is removed.

**Blocked by:** 02 (health check endpoint must exist before the table can be wired)

**Status:** done

- [x] Infrastructure Status table fetches from `GET /api/admin/health` on mount
- [x] Table renders one row per service (PostgreSQL, Paystack, WireGuard) with live status and message from the response
- [x] A loading state is shown while the health fetch is in flight
- [x] An error state is shown if the health endpoint itself fails to respond
- [x] Hardcoded service rows and fake metrics (`Latency: 4ms`, `99.98% delivery rate`, etc.) are gone
- [x] KPI trend badges (`+12% this week`, `+8% vs last month`) are removed from the dashboard
- [x] "Export Log" button is removed
- [x] "Filter" button is removed
- [x] "Issue Voucher" CTA button is removed
