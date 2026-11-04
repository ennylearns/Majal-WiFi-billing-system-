# 05: Plans management restyle

**What to build:** The plans grid in the admin dashboard. After this ticket, each plan is shown in a card with a 12px outer radius, a 56px header block, metric-scale price display, and a primary CTA button — all backed by the existing plans API.

**Blocked by:** 01 — Design-system foundation, 02 — Admin sidebar & nav

**Status:** done

**Reference design:** `frontend-templates/stitch_custom_design_implementation/plans_management_hotspot_packages/screen.png` and `code.html`

- [x] Grid layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- [x] Plan card: `bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden hover:border-border-strong hover:shadow-card-hover transition-all`
- [x] Card header block: `h-14 px-5 border-b border-border-subtle flex items-center justify-between`. Plan name: `font-semibold text-sm text-text-primary`. Tier badge: `rounded-badge border micro-label` using the neutral status variant (`bg-status-neutral-bg border-status-neutral-border text-status-neutral`)
- [x] Price section: `px-5 py-4`. Currency amount uses `text-[2rem] font-bold tabular-nums text-text-primary`. Currency symbol and billing period: `text-sm text-text-muted`
- [x] Feature list items: `text-sm text-text-secondary flex items-center gap-2`; leading checkmark icon in `status-success`
- [x] CTA button: matches primary button spec — `h-10 w-full bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-control transition-colors`
- [x] "Add Plan" / modal trigger button: same primary button spec
- [x] Replace all Lucide icons with Material Symbols equivalents
- [x] All existing state, API calls, and modal logic remain untouched
- [x] All existing tests pass
