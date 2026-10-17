# 01: DB Schema Migration

**What to build:** Update the Payment model so the database is ready to store Paystack transaction references instead of M-Pesa receipt numbers. The schema change must be in place before any other ticket can run.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Drop the `mpesaReceiptNumber` field from the Payment model
- [ ] Add a `paymentReference` field (String, nullable, unique) to the Payment model to store the Paystack transaction reference
- [ ] Change the `paymentMethod` field default from `"MPESA"` to `"PAYSTACK"`
- [ ] Generate and apply a Prisma migration (`prisma migrate dev`)
- [ ] Confirm the database reflects the new schema with no data loss on a fresh seed
