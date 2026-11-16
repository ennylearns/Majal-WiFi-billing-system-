# 02: Health check endpoint

**What to build:** Introduce `GET /api/admin/health` on the backend. It checks three services and returns a status object: (a) PostgreSQL — a lightweight Prisma query to verify reachability, (b) Paystack — whether `PAYSTACK_SECRET_KEY` is set in the environment, (c) WireGuard — whether `wg show` exits cleanly. Each service entry in the response has a `status` of `ok` or `error` and an optional human-readable `message`. Wire the Infrastructure Status table in DashboardOverview to fetch from this endpoint on mount and render the live results, replacing the hardcoded service rows and fake metrics.

**Blocked by:** 01 (mock service guard must be in place so the health check doesn't accidentally activate mocks)

**Status:** ready-for-agent

- [ ] `GET /api/admin/health` returns `{ postgres: { status, message? }, paystack: { status, message? }, wireguard: { status, message? } }`
- [ ] PostgreSQL check uses a minimal Prisma query (e.g. `$queryRaw SELECT 1`)
- [ ] Paystack check is a synchronous env-var presence test, no outbound HTTP call
- [ ] WireGuard check spawns `wg show` and reports `ok` on exit code 0, `error` otherwise
- [ ] Endpoint is protected by admin auth middleware
- [ ] DashboardOverview fetches from the endpoint on mount
- [ ] Each row in the Infrastructure Status table shows the real service name, real status, and real message from the response
- [ ] Fake hardcoded rows (`RouterOS Core Gateway`, `PostgreSQL Database`, etc.) and fake metrics (`Latency: 4ms`, etc.) are removed
- [ ] Test: endpoint returns `postgres.status = ok` when Prisma is reachable (using the in-memory stub pattern)
- [ ] Test: endpoint returns `postgres.status = error` when Prisma throws
- [ ] Test: endpoint returns `paystack.status = ok` when env var is set, `error` when unset
