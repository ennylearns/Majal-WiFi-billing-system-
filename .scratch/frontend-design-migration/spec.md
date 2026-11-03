# Spec: Frontend Design Migration — Precision Infrastructure Utility

Status: ready-for-agent

---

## Problem Statement

The frontend was built quickly with generic Tailwind defaults and Lucide icons. It does not reflect the professional, engineering-grade visual identity that Majal ISP needs for operator-facing and customer-facing screens. A new design system ("Precision Infrastructure Utility") has been produced as a set of static HTML templates and needs to be applied to the React codebase without touching any business logic.

---

## Solution

Restyle the existing React components in-place — keeping all API calls, state management, hooks, routing, and TypeScript types untouched — by replacing Tailwind class strings, swapping the icon library from Lucide to Material Symbols Outlined, and extending the Tailwind config with the canonical design-system token set. The four screens that have templates are migrated first; the shared admin sidebar/nav is migrated as part of that work.

---

## User Stories

1. As an ISP operator, I want the admin login page to match the new brand identity, so that the console feels professional from the first screen.
2. As an ISP operator, I want the sidebar navigation to show Material Symbols icons with a clear active-state indicator, so that I can orient myself in the app at a glance.
3. As an ISP operator, I want the user mini-profile card in the sidebar to show my avatar, online status dot, and role in monospace, so that I know which account I'm operating under.
4. As an ISP operator, I want stat cards on the dashboard to display large tabular metric figures, so that I can read KPIs without scanning for data.
5. As an ISP operator, I want data tables to use hairline-border rows with uppercase micro-label column headers, so that the density matches professional network-management UIs.
6. As an ISP operator, I want status badges (Online / Degraded / Offline) to show a colored leading dot and use the semantic palette, so that I can triage issues at a glance.
7. As an ISP operator, I want IP addresses, timestamps, and session IDs to render in JetBrains Mono, so that they are easy to read and copy.
8. As an ISP operator, I want form inputs and buttons to follow the design system's height (40px), radius (8px for controls), and focus-ring spec, so that the UI feels precise and consistent.
9. As an ISP operator, I want plans management cards to have the new card radius (12px outer) and 56px header blocks, so that the layout is consistent with the rest of the admin dashboard.
10. As a customer, I want the customer hotspot portal to use the new header, semantic palette, and Inter font stack, so that the checkout experience feels polished and trustworthy.
11. As a customer, I want plan selection and status indicators on the customer portal to use the same color semantics as the admin side (success green, danger red, warning amber), so that there is a consistent brand language.
12. As an ISP operator, I want the app to load Inter and JetBrains Mono from Google Fonts, so that typography is consistent across machines.
13. As an ISP operator, I want all interactive elements to show accessible focus rings (3px offset, primary color at 12% opacity), so that keyboard navigation remains usable.

---

## Implementation Decisions

### 0. Foundation changes (must land first)

**`frontend/package.json`** — add `@material-symbols/font-400` as a dependency. This provides the Material Symbols Outlined icon font via npm so it is served locally rather than from a CDN.

**`frontend/index.html`** — add Google Fonts preconnect links and load:
- `Inter` (weights 400, 500, 600, 700)
- `JetBrains Mono` (weights 400, 500, 600)
- `Material Symbols Outlined` variable font (the same `wght,FILL` axes used in the templates)

**`frontend/tailwind.config.js`** — extend the theme with the canonical token set derived from `frontend-templates/stitch_custom_design_implementation/precision_infrastructure_utility/DESIGN.md` and the per-template inline configs. The token names must match exactly what the templates use so class strings can be lifted without renaming:

```
colors:
  surface-canvas:       #F8FAFC
  surface-card:         #FFFFFF
  surface-dim:          #F1F5F9
  border-subtle:        #E2E8F0
  border-strong:        #CBD5E1
  text-primary:         #0F172A
  text-secondary:       #475569
  text-muted:           #64748B
  text-placeholder:     #94A3B8
  primary:              #175CD3
  primary-hover:        #154FB3
  primary-active:       #0E3F96
  primary-light:        #EFF6FF
  status-success:       #16A34A
  status-success-bg:    #F0FDF4
  status-success-border:#BBF7D0
  status-danger:        #DC2626
  status-danger-bg:     #FEF2F2
  status-danger-border: #FECACA
  status-warning:       #D97706
  status-warning-bg:    #FFFBEB
  status-warning-border:#FDE68A
  status-neutral:       #475467
  status-neutral-bg:    #F1F5F9
  status-neutral-border:#E2E8F0

borderRadius:
  card:    12px
  control: 8px
  badge:   6px

fontFamily:
  sans: [Inter, system-ui, sans-serif]
  mono: [JetBrains Mono, monospace]

boxShadow:
  card: "0px 1px 3px 0px rgba(15,23,42,0.04), 0px 1px 2px -1px rgba(15,23,42,0.03)"
  card-hover: "0px 4px 6px -1px rgba(15,23,42,0.06), 0px 2px 4px -2px rgba(15,23,42,0.04)"
  overlay: "0px 10px 15px -3px rgba(15,23,42,0.08), 0px 4px 6px -4px rgba(15,23,42,0.04)"
```

The existing `primary`, `success` colour scales in the config may be removed once every component is migrated, as they are replaced by the flat semantic tokens above. Remove them at the end to avoid breaking interim builds.

**`frontend/src/index.css`** — add the global resets present in the templates:
- `overscroll-behavior: none` on `body`
- `font-feature-settings: "tnum" 1, "cv05" 1` on a `.tabular-nums` utility class for metric/IP cells
- `text-transform: uppercase; letter-spacing: 0.06em` on a `.micro-label` utility class for table column headers

**Icon pattern** — Replace every Lucide import and JSX element with the Material Symbols Outlined inline pattern:
```jsx
<span className="material-symbols-outlined text-[18px]">dashboard</span>
```
The font variation for filled icons (used in the logo area) is controlled via `style={{ fontVariationSettings: "'FILL' 1" }}`.

### 1. Sidebar + top-level nav — `frontend/src/pages/AdminDashboard.tsx`

**Reference template:** `frontend-templates/stitch_custom_design_implementation/admin_dashboard_overview/code.html`

The sidebar is defined inside `AdminDashboard.tsx` as an `<aside>`. Restyle to:
- Fixed 240px white sidebar, `border-r border-border-subtle`, `z-50`
- Brand block: 56px height (`h-14`), `px-4`, `border-b border-border-subtle`; monogram square `w-7 h-7 rounded bg-[#0045A9] text-white font-bold text-xs`; "Admin" badge `px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-dim text-text-muted`
- User mini-profile: `p-3 border-b border-border-subtle`; inner card `rounded-lg bg-surface-canvas border border-border-subtle`; online dot `w-2 h-2 bg-emerald-500 ring-2 ring-white absolute bottom-0 right-0`; role in `font-mono text-[11px]`
- Nav links: `text-xs font-medium gap-2.5 px-3 py-2 rounded-md`; inactive `text-text-muted hover:bg-surface-canvas hover:text-text-primary`; active `bg-primary-light text-[#0045A9] border-l-2 border-[#0045A9]`
- Icon names (Material Symbols): `dashboard`, `group`, `sell`, `wifi_tethering`, `payments`, `router`, `settings`, `logout`
- Main content area offset: `ml-[240px]`

All existing state (`sidebarOpen`, `stats`, `loading`, `refreshing`), hooks (`useAuth`, `useLocation`, `useNavigate`), and API call (`fetchDashboardStats`) are preserved exactly.

### 2. Admin login — `frontend/src/pages/AdminLogin.tsx`

**Reference template:** `frontend-templates/stitch_custom_design_implementation/admin_login_portal_console/code.html`

- Body: `bg-surface-canvas flex items-center justify-center min-h-screen`
- Card: `bg-surface-card rounded-card border border-border-subtle shadow-card w-full max-w-[400px] p-8`
- Logo block: `w-9 h-9 rounded-lg bg-primary` with filled `router` Material Symbol
- Brand name treatment: "Majal" in `font-semibold` + "ISP" in `text-primary font-semibold`
- Subtitle: `text-sm text-text-muted`
- Inputs: `h-10 rounded-control border-border-subtle focus:border-primary focus:ring-3 focus:ring-primary/12 text-sm text-text-primary placeholder:text-placeholder`
- Primary button: `bg-primary hover:bg-primary-hover h-10 rounded-control text-white font-medium text-sm w-full`
- Error messages: `text-status-danger text-sm`

All existing form state, `handleSubmit`, and `useAuth().login` call are preserved.

### 3. Dashboard overview — `frontend/src/components/DashboardOverview.tsx`

**Reference template:** `frontend-templates/stitch_custom_design_implementation/admin_dashboard_overview/code.html`

- Stat cards: `bg-surface-card rounded-card border border-border-subtle shadow-card p-5`; metric value uses `text-[2rem] font-bold tabular-nums text-text-primary`; label uses `text-xs text-text-muted font-medium uppercase tracking-wide`
- Table wrapper: `bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden`
- Table header row: `bg-surface-canvas border-b border-border-subtle`; header cells: `micro-label px-4 h-10 text-left text-text-secondary`
- Table body rows: `border-b border-border-subtle last:border-0 hover:bg-surface-canvas`; body cells: `h-12 px-4 text-sm text-text-primary`
- Numeric/IP cells get `tabular-nums font-mono`
- Status badges: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge text-[11px] font-semibold uppercase tracking-wide border`; colour variants for success/danger/warning/neutral as defined in the token table above; each badge includes a leading `6px` circular dot

### 4. Plans management — `frontend/src/components/PlansManagement.tsx`

**Reference template:** `frontend-templates/stitch_custom_design_implementation/plans_management_hotspot_packages/code.html`

- Plans laid out in a responsive grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Plan card: `bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden`
- Card header block: `h-14 px-5 border-b border-border-subtle flex items-center justify-between` with plan name in `font-semibold text-text-primary` and tier badge in `rounded-badge` style
- Price row: metric-display scale for the amount; currency symbol and billing period in `body-sm text-text-muted`
- CTA button: primary button spec (see § buttons in DESIGN.md)
- "Add Plan" / modal trigger button: matches primary button spec

### 5. Customer portal — `frontend/src/pages/CustomerPortal.tsx`

**Reference template:** `frontend-templates/stitch_custom_design_implementation/customer_portal_hotspot_checkout/code.html`

- No sidebar; public-facing layout
- Sticky header: `h-16 bg-surface-card border-b border-border-subtle`; brand logo + "Customer Hotspot" label; network status pill (green dot + `animate-pulse`)
- Main area: `max-w-5xl mx-auto px-6`
- Plan selection cards: same `rounded-card border` card style, selected state adds `border-primary ring-2 ring-primary/20`
- Checkout / payment section: `bg-surface-card rounded-card border border-border-subtle shadow-card p-6`
- Status indicators use `status-success` / `status-danger` semantic tokens

---

## Testing Decisions

The migration is **purely visual** — no API surface, routing, or state shape changes. Therefore:

- No new test files are needed.
- Existing tests (`ProvisioningScriptModal.test.tsx`, `RoutersManagement.test.tsx`, `App.test.tsx`) must continue to pass green after each component is restyled. These are the primary regression gate.
- A good test for this feature tests external behaviour (the component renders without throwing, the right text appears, API calls fire at the right time), not which CSS class string is present.
- After each component step, run `npm test` in `frontend/` and confirm zero failures before moving to the next component.

---

## Out of Scope

- `frontend/src/components/RoutersManagement.tsx` — no template provided; passively benefits from new Tailwind tokens but is not actively restyled.
- `frontend/src/components/SessionsManagement.tsx` — same as above.
- `frontend/src/components/PaymentsManagement.tsx` — same as above.
- `frontend/src/components/SettingsPage.tsx` — same as above.
- `frontend/src/components/ProvisioningScriptModal.tsx` — same as above.
- Dark mode — the templates declare `darkMode: "class"` but ship no dark-mode variants; dark mode is not implemented.
- Backend / API — zero changes to `frontend/src/services/api.ts` or any server code.
- State, hooks, types, formatters — `frontend/src/hooks/useAuth.tsx`, `frontend/src/types/index.ts`, `frontend/src/utils/formatters.ts` are untouched.
- Routing — `frontend/src/App.tsx` route structure is not changed.

---

## Further Notes

- **Execution order matters.** Step 0 (tailwind config + fonts + icon library) must be committed before any component work begins, otherwise token class names will produce no style and intermediate builds will look broken.
- **Token naming.** The token names chosen (`surface-canvas`, `border-subtle`, `primary`, etc.) match the inline configs already present in the HTML templates exactly, which allows class strings to be copied from the templates with minimal renaming.
- **Existing named Tailwind colours** (`primary-500`, `success-600`, etc.) will conflict with the flat `primary` and `status-success` tokens during the transition. Keep them in the config until all five files are migrated, then remove the old scales in a clean-up commit.
- **Material Symbols font loading.** The templates load the font from Google Fonts CDN. For production, serve it via the `@material-symbols/font-400` npm package and import it in `index.css` to avoid the CDN dependency.
- **Screen images for reference.** Each template folder contains a `screen.png` showing the target visual. Use these for visual QA after each component step.

