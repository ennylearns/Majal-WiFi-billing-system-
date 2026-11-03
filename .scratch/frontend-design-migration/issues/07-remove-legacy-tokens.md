# 07: Remove legacy Tailwind colour scales

**What to build:** Clean up the transitional Tailwind config. After this ticket, the old `primary-50…900` and `success-50…900` colour scales are gone — only the flat design-system tokens introduced in ticket 01 remain. CI stays green because every component is already using the new tokens.

**Blocked by:** 02 — Admin sidebar & nav, 03 — Admin login, 04 — Dashboard overview, 05 — Plans management, 06 — Customer portal

**Status:** ready-for-agent

- [ ] Grep the entire `frontend/src/` tree for any remaining usages of the old token patterns (`primary-50`, `primary-100` … `primary-900`, `success-50` … `success-900`). There should be none after tickets 02–06 land; if any remain, replace them with the nearest design-system token before proceeding
- [ ] Remove the `primary` (50–900 scale) and `success` (50–900 scale) entries from `tailwind.config.js` `theme.extend.colors`
- [ ] Run `npm run build` — confirm zero Tailwind class warnings and the build output size does not regress unexpectedly
- [ ] All existing tests pass (`npm test`)

