# 01: Inject SessionService into PaystackService

**What to build:** Introduce a constructor injection seam into the payment service allowing a session service instance to be passed in, falling back to the default singleton instance when omitted. This makes payment fulfillment testable in isolation without global monkey-patching.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The payment service accepts an optional session service instance in its constructor.
- [x] When no session service instance is passed, the payment service defaults to the standard singleton instance.
- [x] Existing unit tests instantiate the payment service without errors or behavioral regressions.
- [x] A unit test verifies that custom session service mock instances are accepted and retained.
