# 10: WireGuard Tunnel Service

**What to build:** Implement a backend service (`backend/src/services/wireguardService.ts`) to manage WireGuard VPN tunnels for routers behind CGNAT. The service handles keypair generation (WireGuard public and private keys), dynamic IP allocation from a configurable tunnel subnet (defaulting to `10.250.0.0/24`, where `.1` is the server and `.2+` are assigned to routers), peer registration, and peer removal. In production environments with `wg` installed, it issues host system commands (`wg set ...`) to register and remove peers. In test or development environments (or when `wg` is unavailable), it operates gracefully in mock/noop mode. It also inspects tunnel handshake freshness via `wg show` or mock state to report whether a router is actively connected.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Create `backend/src/services/wireguardService.ts` with singleton export `wireguardService`
- [ ] Implement keypair generation using `crypto` or standard WireGuard base64 curve25519 routines
- [ ] Implement tunnel IP address pool allocation within `10.250.0.0/24` (allocating next available IP, reserving `.1` for Majal server)
- [ ] Implement `addPeer(publicKey: string, tunnelIp: string): Promise<void>` executing `wg set <interface> peer <key> allowed-ips <tunnelIp>/32` with graceful fallback if `wg` CLI is missing
- [ ] Implement `removePeer(publicKey: string): Promise<void>` executing `wg set <interface> peer <key> remove` with graceful fallback
- [ ] Implement `getPeerHandshake(publicKey: string): Promise<{ isConnected: boolean; lastHandshakeTime: Date | null }>` checking peer handshake within last 3 minutes
- [ ] Read server WireGuard configuration from environment variables (`WIREGUARD_INTERFACE`, `WIREGUARD_SERVER_ENDPOINT`, `WIREGUARD_SERVER_PUBLIC_KEY`, `WIREGUARD_SUBNET`)
- [ ] Add comprehensive unit tests in `backend/src/services/wireguardService.test.ts` covering key generation, IP allocation, command execution, and mock fallbacks
