# 01: Create Database Client Singleton Module

**What to build:** Create `backend/src/database/db.ts` which instantiates and exports a shared `PrismaClient` singleton with `globalThis` caching in non-production environments to avoid pool exhaustion. Export `prisma` (named & default) and `disconnectDb()`. Add unit tests in `backend/src/database/db.test.ts`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Create `backend/src/database/db.ts` implementing `globalThis` PrismaClient caching for non-production environments.
- [ ] Export `prisma` as a named export, default export, and export `disconnectDb()` helper function.
- [ ] Add unit test suite `backend/src/database/db.test.ts` verifying singleton export and lifecycle behavior.
- [ ] Verify TypeScript compiles cleanly (`npm run build`).
