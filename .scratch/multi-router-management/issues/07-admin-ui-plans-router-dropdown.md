# 07: Admin UI: Plans form gets Router dropdown

**What to build:** Update the Plans management UI so that every plan is associated with a router when created or edited. The plan create/edit modal gains a "Router" dropdown populated from the routers API. The dropdown is required � a plan cannot be saved without selecting a router. The plans table gains a "Router" column showing the router name so admins can audit plan-to-router mappings at a glance. The full round-trip � add a plan on a specific router, see it in the table, edit and reassign to a different router � must work end-to-end.

**Blocked by:** 04, 06

**Status:** completed

- [x] Plan create modal includes a "Router" dropdown populated from the routers API
- [x] The Router dropdown is required; the form cannot be submitted without a selection
- [x] Plan edit modal pre-selects the plan's current router
- [x] Submitting create/edit sends `routerId` to the API and handles validation errors from the server
- [x] Plans table has a "Router" column showing the router name for each plan
- [x] The full create-then-edit flow works end-to-end with correct router assignment
