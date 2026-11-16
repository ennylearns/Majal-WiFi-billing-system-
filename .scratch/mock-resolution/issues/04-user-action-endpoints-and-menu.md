# 04: User action endpoints and menu

**What to build:** Wire up the `MoreVertical` contextual action menu in the Users Management table. The menu exposes four actions for each user: view session history, terminate active sessions, toggle active/inactive status, and view MAC address bindings. Each action is backed by a dedicated admin API endpoint. No new Prisma models are required — all data is already modelled via `Session`, `User.isActive`, and MAC binding records. Remove the "Export Users" and "Filters" buttons.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `MoreVertical` button opens a dropdown or inline action panel (not a no-op)
- [ ] "View Session History" action fetches and displays the user's sessions (plan name, start time, status, duration)
- [ ] "Terminate Active Sessions" action calls a backend endpoint that sets all `ACTIVE` sessions for the user to `TERMINATED` and returns the count terminated
- [ ] "Toggle Active/Inactive" action calls a backend endpoint that flips `User.isActive` and reflects the new state in the row without a full page reload
- [ ] "View MAC Bindings" action fetches and displays all MAC addresses associated with the user
- [ ] All four backend endpoints are protected by admin auth middleware
- [ ] "Export Users" button is removed
- [ ] "Filters" button is removed
- [ ] Test: terminate endpoint sets all user's `ACTIVE` sessions to `TERMINATED` and returns the correct count
- [ ] Test: toggle endpoint flips `isActive` from `true` to `false` and vice versa
