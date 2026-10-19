# 12: RouterOS Provisioning Script API & Granular Diagnostics

**What to build:** Build the RouterOS script generation engine and expose `GET /api/admin/routers/:id/provision-script` in `backend/src/routes/admin.ts`. The generated script is a complete, idempotent RouterOS v7 configuration script that an admin can paste into Winbox Terminal to set up WireGuard CGNAT traversal, API lockdown, dedicated API user, walled garden, and captive portal redirect. Update `POST /api/admin/routers/:id/test-connection` to return granular diagnostics distinguishing whether the WireGuard tunnel is offline versus RouterOS API authentication/reachability failure.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Implement `backend/src/services/provisioningScriptService.ts` to generate idempotent RouterOS v7 scripts
- [ ] Configure WireGuard in script: creates interface `wg-majal`, assigns `wgTunnelIp/24`, adds server peer with `persistent-keepalive=25s` and server endpoint
- [ ] Configure API service in script: enables port 8728 and restricts access strictly to server tunnel IP `10.250.0.1/32`
- [ ] Configure API user and group in script: creates `billing-api` group with minimal required permissions and dedicated API user
- [ ] Configure Walled Garden in script: allows unauthenticated traffic to `PORTAL_DOMAIN` and Paystack domains
- [ ] Configure Hotspot `login.html` in script: redirects browser to `https://<PORTAL_DOMAIN>/?routerId=<ID>&router=$(identity)` and sets profile to `html-directory=hotspot`
- [ ] Ensure all script commands are idempotent (safely re-runnable without duplicate resource errors)
- [ ] Expose `GET /api/admin/routers/:id/provision-script` returning the script text
- [ ] Update `POST /api/admin/routers/:id/test-connection` to query `wireguardService` for handshake status first, then test RouterOS API, returning diagnostic status (`online`, `tunnel_offline`, `auth_failed`, or `unreachable`)
- [ ] Add unit and route tests in `backend/src/services/provisioningScriptService.test.ts` and `backend/src/routes/admin.routers.test.ts`
