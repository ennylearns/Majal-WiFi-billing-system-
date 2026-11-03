# 01: Design-system foundation

**What to build:** Lay the shared infrastructure that every subsequent restyle ticket depends on. After this ticket, all design-system Tailwind tokens, fonts, and icon assets are available globally and every component can reference them.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Install `@material-symbols/font-400` npm package and import it in the global CSS entry point so Material Symbols Outlined glyphs render from local assets (not CDN)
- [ ] Add Google Fonts preconnect links to `index.html` and load Inter (400/500/600/700) and JetBrains Mono (400/500/600) variable weights
- [ ] Extend `tailwind.config.js` with the full canonical token set — every token name must match what the HTML templates already use so class strings can be lifted without renaming:
  - **Surfaces:** `surface-canvas` (#F8FAFC), `surface-card` (#FFFFFF), `surface-dim` (#F1F5F9)
  - **Borders:** `border-subtle` (#E2E8F0), `border-strong` (#CBD5E1)
  - **Text:** `text-primary` (#0F172A), `text-secondary` (#475569), `text-muted` (#64748B), `text-placeholder` (#94A3B8)
  - **Brand:** `primary` (#175CD3), `primary-hover` (#154FB3), `primary-active` (#0E3F96), `primary-light` (#EFF6FF)
  - **Semantic status:** `status-success` (#16A34A) + `-bg` (#F0FDF4) + `-border` (#BBF7D0); `status-danger` (#DC2626) + `-bg` (#FEF2F2) + `-border` (#FECACA); `status-warning` (#D97706) + `-bg` (#FFFBEB) + `-border` (#FDE68A); `status-neutral` (#475467) + `-bg` (#F1F5F9) + `-border` (#E2E8F0)
  - **Border radii:** `card` (12px), `control` (8px), `badge` (6px)
  - **Font families:** `sans` → Inter, `mono` → JetBrains Mono
  - **Box shadows:** `card` (ambient 1px elevation), `card-hover` (4px lift), `overlay` (modal/dropdown weight)
- [ ] Keep the existing legacy colour scales (`primary-50…900`, `success-50…900`) in the config for now — they will be removed in ticket 07 once every component is migrated
- [ ] Add global CSS utilities in `index.css`: `overscroll-behavior: none` on body; `.tabular-nums` applying `font-feature-settings: "tnum" 1, "cv05" 1`; `.micro-label` applying `text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; font-weight: 600`
- [ ] All existing tests pass (`npm test` in `frontend/`)

