# 03: Admin router CRUD + test-connection API

**What to build:** Expose full router management to the admin through a new set of authenticated API endpoints. An admin can list all routers, create a new router, update an existing one, delete one, and test whether a router is reachable. The test-connection endpoint attempts to connect to the router using the stored credentials and returns a clear pass/fail response — it does not persist any state. All endpoints require admin authentication (same middleware as existing admin routes). Integration tests cover all five endpoints following the pattern of `public.test.ts`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `GET /api/admin/routers` returns a list of all router records
- [ ] `POST /api/admin/routers` creates a router with validated name, location, host, port, username, password fields; returns the created record
- [ ] `PUT /api/admin/routers/:id` updates any subset of router fields; returns the updated record
- [ ] `DELETE /api/admin/routers/:id` soft-deletes the router (sets `isActive = false`) if active sessions reference it, or hard-deletes otherwise; returns success confirmation
- [ ] `POST /api/admin/routers/:id/test-connection` attempts a MikroTik API connection with the router's stored credentials; returns `{success: true}` or `{success: false, error: string}`
- [ ] All endpoints reject unauthenticated and non-admin requests
- [ ] Integration tests exist and pass for all five endpoints
