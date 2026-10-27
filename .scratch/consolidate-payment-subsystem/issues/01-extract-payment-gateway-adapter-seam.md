# 01: Extract Payment Gateway Adapter Seam

**What to build:** An abstraction seam that decouples payment processing operations from third-party vendor APIs, allowing the system to initiate transactions, verify transactions, and validate cryptographic webhook signatures through an interchangeable gateway interface with an in-memory test fake.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Define payment gateway interface covering transaction initiation, transaction verification, and webhook signature verification
- [ ] Wrap production gateway HTTP calls into an adapter satisfying the interface
- [ ] Create an in-memory fake gateway adapter supporting simulated successes, failures, and deterministic references for testing
- [ ] Verify that existing vendor transaction initiation and webhook signature checks function identically through the new adapter
