# 02: Implement Payment Initiation and Guest Resolution

**What to build:** End-to-end checkout initiation logic where captive portal visitors can purchase internet plans with their phone or email, automatically resolving or provisioning a customer record, creating a pending payment record, and generating a gateway checkout reference.

**Blocked by:** 01: Extract Payment Gateway Adapter Seam

**Status:** ready-for-agent

- [ ] Core payment service receives plan selection, amount, and optional customer contact details
- [ ] Service finds existing customer by phone/email or creates a new guest customer record inside the initiation flow
- [ ] Service creates a pending payment record associated with the customer and selected plan
- [ ] Service invokes the payment gateway adapter to request a checkout transaction reference and access code
- [ ] Service records the returned gateway reference on the payment record and returns authorization details
- [ ] Tests verify successful initiation, guest creation, and inactive plan rejection using the fake gateway adapter
