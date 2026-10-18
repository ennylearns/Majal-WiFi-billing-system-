# 08: Customer portal: group plans by router location

**What to build:** Update the customer-facing plans page so that plans are displayed grouped under their router's name and location as a section heading, rather than a flat undifferentiated list. A customer at a specific physical location can immediately see which plans are available there. The full purchase flow — select a plan, pay, connect — must continue to work correctly end-to-end, with the resulting session on the router that the chosen plan belongs to.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Customer portal plans list renders plans grouped by router location (one section heading per router)
- [ ] Each section heading shows the router name and/or location description
- [ ] Plans within each group display correctly (name, price, duration, data, speed)
- [ ] If only one router exists, plans still render correctly (single group, no regression)
- [ ] Selecting a plan and completing the full purchase + connect flow works end-to-end
- [ ] Empty state (no plans available) is handled gracefully
