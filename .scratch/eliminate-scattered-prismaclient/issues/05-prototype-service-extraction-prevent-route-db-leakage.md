# 05: Prototype Service Extraction to Prevent Route DB Leakage

**What to build:** Prototype extracting domain services (e.g., `planService`, `userService`, `authService`) for route handlers currently performing raw database queries ([plans.ts](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/routes/plans.ts), [auth.ts](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/routes/auth.ts), [admin.ts](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/routes/admin.ts)). Verify whether routes can become pure HTTP dispatchers that never import or depend on [PrismaClient](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/database/db.ts) directly.

**Blocked by:** 04

**Status:** ready-for-human

- [ ] Prototype extracting a `planService` from [plans.ts](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/routes/plans.ts) to handle plan retrieval and filtering.
- [ ] Prototype extracting `authService` or `userService` from [auth.ts](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/routes/auth.ts) to handle user lookups and authentication queries.
- [ ] Measure seam depth: verify route files only validate HTTP payloads and call service methods without importing [prisma](file:///c:/Users/HP/Desktop/Jobs/Majal-WiFi-billing-system-/backend/src/database/db.ts).
- [ ] Document findings and migration roadmap in issue comments or follow-up spec.
