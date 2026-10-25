# 04: Migrate Integration Tests and Seed Scripts

**What to build:** Update database seed scripts and integration test suites to share the centralized `prisma` instance from `backend/src/database/db.ts` instead of constructing ad-hoc `new PrismaClient()` instances.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] Update `backend/src/database/seed.ts` to import `{ prisma } from './db'`.
- [ ] Update `backend/src/routes/admin.routers.test.ts` to import `{ prisma } from '../database/db'`.
- [ ] Update `backend/src/routes/admin.plans.test.ts` to import `{ prisma } from '../database/db'`.
- [ ] Update `backend/src/routes/public.test.ts` to import `{ prisma } from '../database/db'`.
- [ ] Run full test suite (`npm test`) to ensure zero regressions across all tests.
