# 04: Migrate Integration Tests and Seed Scripts

**What to build:** Update database seed scripts and integration test suites to share the centralized `prisma` instance from `backend/src/database/db.ts` instead of constructing ad-hoc `new PrismaClient()` instances.

**Blocked by:** 01, 02, 03

**Status:** ready-for-human

- [x] Update `backend/src/database/seed.ts` to import `{ prisma } from './db'`.
- [x] Update `backend/src/routes/tests/admin.routers.test.ts` to import `{ prisma } from '../../database/db'`.
- [x] Update `backend/src/routes/tests/admin.plans.test.ts` to import `{ prisma } from '../../database/db'`.
- [x] Update `backend/src/routes/tests/public.test.ts` to import `{ prisma } from '../../database/db'`.
- [x] Run full test suite (`npm test`) to ensure zero regressions across all tests.
