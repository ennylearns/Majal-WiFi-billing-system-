# 09: Update project docs

**What to build:** Bring all project-facing documentation up to date to reflect the multi-router architecture. Docs should accurately describe the new Router entity, the plan-to-router relationship, the startup seed behaviour, and how to add and manage routers via the admin UI. Any references to the single-router env-var config should be updated to clarify that those vars are now used only for the one-time seed. The `.env.example` file is updated with explanatory comments. README and DEPLOYMENT docs are revised where they mention MikroTik setup.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 13

**Status:** closed

- [x] `README.md` MikroTik setup section updated to describe the multi-router model, WireGuard CGNAT traversal, and the admin UI for managing routers
- [x] `DEPLOYMENT.md` updated: WireGuard server setup guide, env-var router config documented as a one-time seed, and instructions for provisioning routers via generated scripts
- [x] `.env.example` updated with `WIREGUARD_*` and `PORTAL_DOMAIN` variables, and comments on legacy `MIKROTIK_*` vars
- [x] Add operator guide explaining how to paste the provisioning script into Winbox Terminal
- [x] Any other docs referencing a single hardcoded router (e.g. `quick-start.md`) are updated to match the new architecture
- [x] No doc references the old singleton MikrotikService pattern as current behaviour
