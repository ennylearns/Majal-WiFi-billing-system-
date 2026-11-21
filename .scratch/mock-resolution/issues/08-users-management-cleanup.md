# 08: Users Management cleanup

**What to build:** Complete the Users Management page by rendering the action menu wired in ticket 04 and removing the two dead buttons. This ticket is primarily a frontend integration ticket that consumes the endpoints from ticket 04.

**Blocked by:** 04 (user action endpoints must exist)

**Status:** done

- [x] `MoreVertical` button on each user row renders a visible action dropdown / panel with the four actions from ticket 04
- [x] Each action dispatches to the correct endpoint and shows a success or error toast on completion
- [x] User row reflects updated status immediately after a Toggle Active/Inactive action (optimistic update or re-fetch)
- [x] Session history and MAC bindings are displayed in a modal or inline panel
- [x] "Export Users" button is removed
- [x] "Filters" button is removed
