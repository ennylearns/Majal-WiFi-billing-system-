# 03: Migrate Routes and Middleware to Shared Database Singleton

**What to build:** Replace all scattered `const prisma = new PrismaClient()` occurrences in route handlers and middleware with imports from `backend/src/database/db.ts`.

**Blocked by:** 01

**Status:** ready-for-human

- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/admin.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/public.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/auth.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/plans.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/payments.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/routes/sessions.ts` with `import { prisma } from '../database/db'`.
- [x] Replace `const prisma = new PrismaClient()` in `backend/src/middleware/auth.ts` with `import { prisma } from '../database/db'`.
- [x] Verify that TypeScript compiles cleanly across all routes.
