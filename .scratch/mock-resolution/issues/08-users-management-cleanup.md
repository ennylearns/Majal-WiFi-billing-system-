# 08: Users Management cleanup

**What to build:** Complete the Users Management page by rendering the action menu wired in ticket 04 and removing the two dead buttons. This ticket is primarily a frontend integration ticket that consumes the endpoints from ticket 04.

**Blocked by:** 04 (user action endpoints must exist)

**Status:** ready-for-agent

- [ ] `MoreVertical` button on each user row renders a visible action dropdown / panel with the four actions from ticket 04
- [ ] Each action dispatches to the correct endpoint and shows a success or error toast on completion
- [ ] User row reflects updated status immediately after a Toggle Active/Inactive action (optimistic update or re-fetch)
- [ ] Session history and MAC bindings are displayed in a modal or inline panel
- [ ] "Export Users" button is removed
- [ ] "Filters" button is removed
