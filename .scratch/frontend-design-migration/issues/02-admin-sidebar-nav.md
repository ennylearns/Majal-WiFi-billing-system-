# 02: Admin sidebar & nav restyle

**What to build:** The persistent 240px sidebar inside the admin dashboard shell is the first thing every operator sees. After this ticket the sidebar matches the Precision Infrastructure Utility template exactly: fixed left panel, brand block, user mini-profile card with live status dot, and nav links with a clear active-state indicator — all using Material Symbols Outlined icons instead of Lucide.

**Blocked by:** 01 — Design-system foundation

**Status:** done

**Reference design:** `frontend-templates/stitch_custom_design_implementation/admin_dashboard_overview/screen.png` and `code.html` (sidebar section, lines ~29–105)

- [x] Replace all Lucide icon imports and JSX elements in the admin dashboard shell with Material Symbols Outlined inline spans: `<span className="material-symbols-outlined text-[18px]">icon_name</span>`. Icon mapping: Dashboard → `dashboard`, Users → `group`, Plans → `sell`, Sessions → `wifi_tethering`, Payments → `payments`, Routers → `router`, Settings → `settings`, Logout → `logout`
- [x] Sidebar outer shell: `fixed left-0 top-0 h-full w-[240px] bg-surface-card border-r border-border-subtle z-50 flex flex-col justify-between`; main content area gets `ml-[240px]`
- [x] Brand block (top, 56px): `h-14 px-4 border-b border-border-subtle flex items-center justify-between`. Monogram: `w-7 h-7 rounded bg-[#0045A9] text-white font-bold text-xs flex items-center justify-center` showing "M". "Majal ISP" label in `font-semibold text-sm text-text-primary`. "Admin" badge: `px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-dim text-text-muted`
- [x] User mini-profile block: `p-3 border-b border-border-subtle`. Inner card: `flex items-center gap-2.5 p-2 rounded-lg bg-surface-canvas border border-border-subtle`. Avatar: `w-8 h-8 rounded-full object-cover` with a `w-2 h-2 bg-emerald-500 ring-2 ring-white absolute bottom-0 right-0` online dot. Username: `text-xs font-semibold text-text-primary`. Role: `text-[11px] font-mono text-text-muted`
- [x] Nav links: `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors`. Inactive: `text-text-muted hover:bg-surface-canvas hover:text-text-primary`. Active: `bg-primary-light text-[#0045A9] border-l-2 border-[#0045A9]`
- [x] All existing state (`sidebarOpen`, `stats`, `loading`, `refreshing`), hooks (`useAuth`, `useLocation`, `useNavigate`), and `fetchDashboardStats` API call remain untouched
- [x] All existing tests pass

