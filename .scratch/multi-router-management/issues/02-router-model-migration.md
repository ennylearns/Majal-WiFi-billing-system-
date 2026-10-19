# 02: Add Router model + Plan/Session routerId migration

**What to build:** Introduce the `Router` entity to the database and wire it into `Plan` and `Session`. The schema gains a `Router` model with fields: `id`, `name`, `location`, `host`, `port` (integer, default 8728), `username`, `password`, `isActive` (default true), `createdAt`, `updatedAt`. The `Plan` model gains a `routerId` foreign key referencing `Router`. The `Session` model gains a `routerId` field (denormalized from the plan at session-creation time — populated in a later ticket, but the column must exist now). A Prisma migration is generated and applied. On server startup, seed logic runs: if `MIKROTIK_HOST` is present in the environment and no `Router` rows exist, one Router record is created from env-var values (name defaults to `"Default Router"`, location to `"Main Location"`), and all existing `Plan` rows are updated to reference it. If env vars are absent and no routers exist, the seed is skipped silently.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `Router` model exists in Prisma schema with all specified fields
- [x] `Plan.routerId` foreign key exists in schema (nullable initially to allow migration of existing rows)
- [x] `Session.routerId` field exists in schema
- [x] Migration file is generated and applies cleanly against the existing database
- [x] Startup seed creates a default Router from env vars when `MIKROTIK_HOST` is set and no routers exist
- [x] Startup seed backfills all existing Plans with the seeded router's ID
- [x] Startup seed is idempotent — running it twice does not create duplicate routers
- [x] Server starts successfully after migration with no runtime errors
