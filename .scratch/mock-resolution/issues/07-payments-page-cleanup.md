# 07: Payments page cleanup

**What to build:** Wire the four summary KPI cards on the Payments page to the aggregate totals now returned by the payments API, and remove the "Export Report" button. This ticket is a frontend-only change that consumes the totals added in ticket 03.

**Blocked by:** 03 (payments aggregate totals must be in the API response)

**Status:** done

- [x] Total Revenue card shows the all-time revenue figure from `response.totals.revenue`
- [x] Total Payments card shows `response.totals.count`
- [x] Pending card shows `response.totals.pending`
- [x] Failed card shows `response.totals.failed`
- [x] None of the four cards compute their value from `payments.reduce(...)` over the current page slice
- [x] "Export Report" button is removed from the Payments page
