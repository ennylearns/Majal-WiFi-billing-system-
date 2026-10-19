# 13: Admin UI Provisioning Script Modal & Diagnostics

**What to build:** Enhance `frontend/src/components/RoutersManagement.tsx` to streamline the router setup workflow. Simplify the "Add Router" form so admins only need to provide Name and Location (credentials and tunnel host are auto-assigned). When a router is created, immediately pop up the "Provisioning Script" modal displaying the generated RouterOS script with a one-click copy button and Winbox terminal instructions. Add a "Setup Script" button to each row in the routers table so admins can view or copy the script at any time. Update the "Test Connection" status indicator to show granular badges reflecting WireGuard tunnel status and API health.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] Update "Add Router" modal to require only `Name` and `Location` (hide or make optional `host`, `port`, `username`, `password`)
- [ ] Create `ProvisioningScriptModal` component:
  - Fetches script from `GET /api/admin/routers/:id/provision-script`
  - Renders script in a monospace code block with quick scrolling
  - One-click "Copy to Clipboard" button with feedback toast/state
  - Clear 3-step Winbox terminal paste instructions
- [ ] Auto-open `ProvisioningScriptModal` immediately after an admin submits the "Add Router" form
- [ ] Add a "Setup Script" action button (terminal/code icon) to each row in the routers table
- [ ] Enhance "Test Connection" action to display granular status badges: `Online` (green), `Tunnel Offline (Pending Setup)` (amber), `Auth Error` (red), `Unreachable` (gray)
- [ ] Add frontend tests covering modal behavior, script fetching, and clipboard copy interaction
