# 01: Expand MikrotikService to accept explicit credentials

**What to build:** Refactor `MikrotikService` so it can be instantiated with explicit connection credentials (`host`, `port`, `username`, `password`) passed directly to the constructor, rather than always reading from environment variables. The existing module-level singleton exported from the service module must be kept intact alongside the new form so that no existing call site breaks yet. Add unit tests that instantiate the class with stub credentials, mock `RouterOSAPI` from `node-routeros` at the module boundary, and assert that each public method (`createHotspotUser`, `removeHotspotUser`, `getActiveUsers`, `disconnectUser`, `createUserProfile`, `updateUserProfile`) writes the correct API commands and arguments. Follow the pattern established in `paystackService.test.ts`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `MikrotikService` constructor accepts `{host, port, username, password}` parameters
- [ ] When constructed with explicit credentials, those credentials are used — env vars are ignored
- [ ] The existing module-level singleton (constructed from env vars) is still exported and unchanged
- [ ] All existing call sites in `sessionService` and `admin` routes continue to compile and run without modification
- [ ] Unit tests exist for each public method of the class, using stub credentials and a mocked `RouterOSAPI`
- [ ] All tests pass
