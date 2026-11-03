# 04: Dashboard overview restyle

**What to build:** The main operator view. After this ticket, stat cards show large tabular metric figures, data tables use hairline-border rows with uppercase micro-label column headers, and status badges include a colored leading dot — all using real live data from the existing API.

**Blocked by:** 01 — Design-system foundation, 02 — Admin sidebar & nav

**Status:** ready-for-agent

**Reference design:** `frontend-templates/stitch_custom_design_implementation/admin_dashboard_overview/screen.png` and `code.html` (main content section)

- [ ] Stat cards: `bg-surface-card rounded-card border border-border-subtle shadow-card p-5`. Metric value: `text-[2rem] font-bold tabular-nums text-text-primary` (apply the `.tabular-nums` utility from ticket 01). Label: `micro-label text-text-secondary` (apply `.micro-label` utility). Card hover: border transitions to `border-strong`, shadow to `shadow-card-hover`
- [ ] Table wrapper: `bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden`
- [ ] Table header row: `bg-surface-canvas border-b border-border-subtle`. Header cells: `micro-label h-10 px-4 text-left text-text-secondary` (all uppercase via `.micro-label`)
- [ ] Table body rows: `border-b border-border-subtle last:border-0 hover:bg-surface-canvas`. Body cells: `h-12 px-4 text-sm text-text-primary`. Numeric/IP/timestamp cells additionally get `tabular-nums font-mono`
- [ ] Status badges: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge border micro-label`. Leading dot: `w-1.5 h-1.5 rounded-full`. Colour variants:
  - Online/Active: `bg-status-success-bg border-status-success-border text-status-success` + green dot
  - Degraded/Warning: `bg-status-warning-bg border-status-warning-border text-status-warning` + amber dot
  - Offline/Error: `bg-status-danger-bg border-status-danger-border text-status-danger` + red dot
  - Neutral/Idle: `bg-status-neutral-bg border-status-neutral-border text-status-neutral` + grey dot
- [ ] Replace all Lucide icons in this component with Material Symbols equivalents
- [ ] All existing state, API calls, and data-mapping logic remain untouched
- [ ] All existing tests pass

