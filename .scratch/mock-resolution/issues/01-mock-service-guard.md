# 01: Mock service guard

**What to build:** Gate both the Paystack mock fallback (which generates `mock_ref_...` references) and the WireGuard mock fallback behind an explicit `MOCK_SERVICES=true` environment flag. If the flag is absent and the real dependency is not configured (`PAYSTACK_SECRET_KEY` unset, or `wg` binary not found), the service must throw a descriptive error at the point of use — not silently fall back to mock behaviour. Local development and CI set `MOCK_SERVICES=true` in their env files. Write tests verifying the guard throws when the flag is absent and the real dependency is missing.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Paystack service checks `MOCK_SERVICES=true` before activating mock mode; throws a descriptive error otherwise if `PAYSTACK_SECRET_KEY` is unset
- [x] WireGuard service checks `MOCK_SERVICES=true` before activating mock mode; throws a descriptive error otherwise if `wg` binary is unavailable
- [x] Error messages name the missing configuration (`PAYSTACK_SECRET_KEY` / `wg` binary) and hint at the fix
- [x] Existing tests in `paystackService.test.ts` and `wireguardService.test.ts` still pass (they run under `MOCK_SERVICES=true`)
- [x] New test: instantiating PaystackService without `MOCK_SERVICES=true` and without `PAYSTACK_SECRET_KEY` throws
- [x] New test: instantiating WireguardService without `MOCK_SERVICES=true` and without `wg` binary throws
