# 05: Migrate sessionService to per-router MikrotikService

**What to build:** Remove the hard dependency on the module-level MikrotikService singleton from the session flow. When a session is created, the service looks up the plan's router record and constructs a MikrotikService instance with those credentials to create the hotspot user profile and hotspot user on the correct router. The session record stores the `routerId` at creation time. When a session is terminated — whether triggered manually, by expiry check, or by the cleanup cron — the service reads `routerId` from the session record and constructs the appropriate MikrotikService instance to remove the hotspot user from the correct router. Once all call sites are migrated, the module-level singleton is deleted.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] `sessionService.createSession()` fetches the Router record via the plan's `routerId` and uses a per-router MikrotikService instance to create the hotspot user and profile
- [ ] The created Session record has its `routerId` field populated
- [ ] `sessionService.terminateSession()` reads `routerId` from the Session record and uses a per-router MikrotikService instance to remove the hotspot user
- [ ] The session cleanup cron constructs per-router MikrotikService instances for each expired session independently
- [ ] The module-level MikrotikService singleton is removed; no remaining imports reference it
- [ ] Server starts and all session flows work end-to-end
- [ ] All existing tests pass
