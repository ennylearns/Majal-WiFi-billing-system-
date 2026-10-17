# 05: Cleanup & Docs

**What to build:** Remove every remaining trace of M-Pesa from documentation, deployment guides, and configuration files, and add the Paystack-specific setup notes an operator needs to go live.

**Blocked by:** 03 (Backend Routes), 04 (Customer Portal)

**Status:** ready-for-agent

- [ ] No occurrence of `mpesa`, `M-Pesa`, `MPESA`, `STK`, or `Daraja` survives a case-insensitive grep of the repo (excluding `.git/` and `node_modules/`)
- [ ] `README.md` updated: M-Pesa removed from features list and prerequisites; Paystack added with a note on supported channels (card, bank transfer)
- [ ] `DEPLOYMENT.md` updated: M-Pesa env vars removed; `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` added with instructions; a note added that the Paystack webhook URL (`/api/public/payment/paystack/webhook`) must be registered in the Paystack dashboard under Settings → API Keys & Webhooks
- [ ] `docker-compose.yml` (if it references M-Pesa env vars) updated
- [ ] `quick-start.md` updated if it references M-Pesa setup steps
- [ ] All docs use Paystack terminology consistently (no leftover Daraja / shortcode / passkey language)
