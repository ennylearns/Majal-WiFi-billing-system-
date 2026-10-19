# 06: Admin UI: Routers tab

**What to build:** Add a "Routers" section to the admin dashboard so administrators can manage their router fleet from the UI. The tab shows a table of all registered routers with columns for name, location, host, status (active/inactive), and action buttons. Each row has Edit, Delete, and Test Connection actions. Test Connection gives immediate inline feedback (connected / failed + error message). An Add Router button opens a modal form for creating a new router. The same modal is reused for editing. Credentials (password field) are masked in the table but editable in the modal.

**Blocked by:** 03

**Status:** closed

- [x] "Routers" tab appears in the admin dashboard navigation alongside existing tabs
- [x] Routers table displays name, location, host, port, and active status for each router
- [x] "Add Router" button opens a modal with fields for name, location, host, port, username, and password
- [x] Submitting the add modal calls the create API and refreshes the table on success
- [x] Each table row has an Edit button that opens the modal pre-filled with the router's current values
- [x] Submitting the edit modal calls the update API and refreshes the table on success
- [x] Each table row has a Delete button that prompts for confirmation then calls the delete API
- [x] Each table row has a "Test Connection" button that calls the test-connection API and shows a clear success or failure message inline
- [x] Loading, error, and empty states are handled gracefully throughout
