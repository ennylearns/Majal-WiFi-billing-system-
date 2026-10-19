# 11: Router Model WireGuard Fields & Automatic Tunnel Provisioning

**What to build:** Extend the Prisma `Router` model and database schema to store WireGuard tunnel attributes (`wgPublicKey`, `wgPrivateKey`, `wgTunnelIp`). Update the admin router CRUD endpoints in `backend/src/routes/admin.ts` so creating a router automatically generates WireGuard keys, allocates a tunnel IP, sets `host = tunnelIp`, auto-generates secure API credentials (if not supplied), and registers the peer with `wireguardService`. Deleting a router automatically unregisters the WireGuard peer and frees its IP.

**Blocked by:** 10

**Status:** done

- [x] Update `prisma/schema.prisma` `Router` model with `wgPublicKey String?`, `wgPrivateKey String?`, `wgTunnelIp String?`
- [x] Run migration to apply schema update
- [x] Update `POST /api/admin/routers` handler to:
  - Require only `name` and `location` in payload
  - Auto-generate secure API username/password if omitted
  - Generate WireGuard keypair and allocate next available tunnel IP via `wireguardService`
  - Set `host` to the allocated tunnel IP
  - Persist router with tunnel fields and register peer via `wireguardService.addPeer`
- [x] Update `DELETE /api/admin/routers/:id` handler to call `wireguardService.removePeer(router.wgPublicKey)`
- [x] Update existing router seed logic (`routerSeedService.ts`) to handle or migrate WireGuard fields cleanly
- [x] Update admin router tests in `backend/src/routes/admin.routers.test.ts` to verify auto-generation of credentials, tunnel allocation, and peer registration
