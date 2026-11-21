# 05: Settings page cleanup

**What to build:** Refactor the Settings page so it reflects env-only configuration instead of pretending to persist changes. The General and Paystack tabs become read-only displays of environment variable values (business name, support email, Paystack webhook URL, Paystack public key with the secret key masked). All "Save" / "Save Changes" buttons are removed from these tabs. The Router tab body is replaced with a navigational card that links to the Routers management page — the editable form, the "Test Connection" button, and all `settings.router.*` local state are removed. The Security and Database tabs are deleted entirely.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] General tab fields (business name, support email) are read-only, sourced from env vars exposed by a backend endpoint or build-time config
- [x] Paystack tab shows webhook URL and public key as read-only; secret key is masked or omitted; "Save Paystack Settings" button is removed
- [x] Router tab renders a navigational card with a link/button to `/admin/routers`; the IP/port/username/password form is gone
- [x] "Test Connection" button in the old Router tab form is removed
- [x] `settings.router.*` state and `renderRouterSettings` function are deleted
- [x] Security tab entry and render function are deleted
- [x] Database tab entry and render function are deleted
- [x] No `toast.success` calls remain on any "Save" action in the Settings page
