# 06: Customer portal restyle

**What to build:** The public-facing hotspot checkout page. After this ticket the customer portal has a sticky branded header, plan selection cards with a selected-state ring, a checkout card, and semantic status indicators — no sidebar, different shell from the admin dashboard.

**Blocked by:** 01 — Design-system foundation

**Status:** done

**Reference design:** `frontend-templates/stitch_custom_design_implementation/customer_portal_hotspot_checkout/screen.png` and `code.html`

- [x] Page layout: `bg-surface-canvas text-text-primary font-sans antialiased min-h-screen flex flex-col justify-between`
- [x] Sticky header: `sticky top-0 w-full z-40 bg-surface-card border-b border-border-subtle`. Inner: `h-16 max-w-5xl mx-auto px-6 flex items-center justify-between`. Brand logo + divider + "Customer Hotspot" label in `text-sm font-semibold text-text-primary`. Network status pill: `bg-surface-dim border border-border-subtle rounded-control px-2.5 py-1 text-xs flex items-center gap-2`; leading dot `w-2 h-2 rounded-full bg-status-success animate-pulse`
- [x] Main content area: `max-w-5xl mx-auto px-6 py-8 flex-1`
- [x] Plan selection cards: `bg-surface-card rounded-card border border-border-subtle shadow-card cursor-pointer transition-all hover:border-border-strong`. Selected state: additionally `border-primary ring-2 ring-primary/[0.12]`
- [x] Checkout / payment card: `bg-surface-card rounded-card border border-border-subtle shadow-card p-6`
- [x] Semantic status indicators reuse the same badge component spec from ticket 04 (online/degraded/offline variants)
- [x] Replace all Lucide icons with Material Symbols equivalents
- [x] All existing state, API calls, and business logic remain untouched
- [x] All existing tests pass
