# 03: Admin login page restyle

**What to build:** The login screen is the entry point to the console. After this ticket it shows a centered card with the new Majal brand logo treatment, restyled inputs, and a primary button — all wired to the existing authentication logic.

**Blocked by:** 01 — Design-system foundation

**Status:** ready-for-agent

**Reference design:** `frontend-templates/stitch_custom_design_implementation/admin_login_portal_console/screen.png` and `code.html`

- [ ] Page layout: `bg-surface-canvas flex items-center justify-center min-h-screen p-4`
- [ ] Login card: `bg-surface-card rounded-card border border-border-subtle shadow-card w-full max-w-[400px] p-8`
- [ ] Logo block: `w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm` containing a filled `router` Material Symbol (`fontVariationSettings: "'FILL' 1"`). Brand name: "Majal" in `text-[20px] font-semibold text-text-primary` + "ISP" in `text-[20px] font-semibold text-primary`. Subtitle: `text-sm text-text-muted text-center`
- [ ] Form inputs: `h-10 w-full rounded-control border border-border-subtle px-3 text-sm text-text-primary placeholder:text-placeholder focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/[0.12]`. Error state: `border-status-danger focus:ring-status-danger/[0.12]`
- [ ] Primary button: `w-full h-10 bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium text-sm rounded-control transition-colors`
- [ ] Error message display: `text-status-danger text-sm`
- [ ] All existing form state, `handleSubmit`, and `useAuth().login` call remain untouched — only classNames and the icon change
- [ ] All existing tests pass

