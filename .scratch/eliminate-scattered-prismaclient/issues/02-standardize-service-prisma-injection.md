# 02: Standardize Service Constructor Prisma Injection

**What to build:** Update `SessionService`, `PaystackService`, `RouterService`, and `RouterSeedService` to uniformly accept an optional `prismaClient: PrismaClient = prisma` parameter in their constructors, defaulting to the shared singleton from `backend/src/database/db.ts`. Remove all local `new PrismaClient()` instantiations across services and ensure `SessionService` methods and `sessionCleanup` operate on `this.prisma`.

**Blocked by:** 01

**Status:** ready-for-human

- [x] Update `backend/src/services/sessionService.ts` to accept `prismaClient: PrismaClient = prisma` in its constructor, store as `this.prisma`, and update all query methods to reference `this.prisma`.
- [x] Update `backend/src/services/paystackService.ts` constructor to default to the shared `prisma` singleton instead of calling `new PrismaClient()` inline.
- [x] Update `backend/src/services/routerService.ts` and `backend/src/services/routerSeedService.ts` to import `prisma` from `../database/db` as default dependency instead of module-level `const defaultPrisma = new PrismaClient()`.
- [x] Add unit tests for `SessionService` verifying custom mock Prisma client injection.
- [x] Verify existing service unit tests (`routerService.test.ts`, `paystackService.test.ts`) continue to pass.
