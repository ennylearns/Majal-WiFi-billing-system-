# 04: Wire Plan API to routerId

**What to build:** Update the plan management API so that every plan is associated with a router. The admin plan create and update endpoints now accept a `routerId` field and validate that the referenced router exists. The public plans endpoint returns each plan's router `name` and `location` alongside the plan data so the frontend can group plans by location without an extra request. Plans submitted without a valid `routerId` are rejected. Existing integration tests are updated and new ones added to cover the router association behaviour.

**Blocked by:** 02, 03

**Status:** completed

- [x] Admin `POST /api/admin/plans` accepts and validates `routerId`; rejects requests where `routerId` is missing or does not reference an existing router
- [x] Admin `PUT /api/admin/plans/:id` accepts and validates `routerId` updates
- [x] Public `GET /api/public/plans` response includes `routerId`, router `name`, and router `location` for each plan
- [x] Admin `GET /api/admin/plans` response includes router name for each plan
- [x] Integration tests cover plan creation with valid and invalid `routerId`
- [x] All existing plan-related tests still pass
