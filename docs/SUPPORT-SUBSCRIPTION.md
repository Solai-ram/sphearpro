# Support runbook — SaaS subscription

For clinic admins and platform operators. Commercial rules: [`SAAS-DECISIONS.md`](./SAAS-DECISIONS.md).

**Plan:** `STANDARD` — ₹2,300 / month (monthly) or ₹1,800 / month effective on annual (`STANDARD_YEARLY`, ₹21,600/yr) · **10 staff + 1 admin**  
**Grace:** 5 days after failed payment  
**Cancel:** at period end by default  
**Data:** never delete clinical data on expiry

---

## Status cheat sheet

| Status | Clinic HIS access? | Typical cause | Support action |
|--------|--------------------|---------------|----------------|
| `TRIALING` | No (awaiting first paid webhook) | Signup / checkout started | Ask them to complete Razorpay payment; check webhook |
| `ACTIVE` | Yes | Paid / renewed | None |
| `GRACE_PERIOD` | Yes (temporary) | Payment failed | Urge update payment method; check Mail |
| `PAST_DUE` / `PAYMENT_FAILED` | No (maps to grace quickly) | Provider pending/fail | Same as grace |
| `EXPIRED` | No | Grace ended unpaid | Collect payment or platform **extend** |
| `CANCELLED` | No | Cancelled | Re-subscribe / checkout |
| `SUSPENDED` | No | Provider halted / platform suspend | Platform **reactivate** or repay |

---

## Clinic self-serve

1. **Billing home:** `/subscription` (clinic **ADMIN** only)
2. **Pay / renew:** `/subscription/checkout`
3. **History:** `/subscription/payments`, `/subscription/invoices`
4. **Signup:** public `/signup` → creates clinic + admin → checkout

Doctors and other staff **cannot** manage subscription (by design).

---

## Grace period

1. Payment fails → status → `GRACE_PERIOD` (5 days).
2. Clinic keeps using HIS; banner should warn them.
3. Email: payment failed (needs clinic `email` set).
4. If still unpaid when grace ends → hourly job expires → `EXPIRED`.
5. Clinical data remains; login may work but HIS APIs return subscription errors until paid/extended.

---

## Expired clinic

1. Confirm status in platform console `/platform` or DB.
2. Options:
   - Clinic completes checkout / Razorpay renew → webhook → `ACTIVE`
   - Platform **Extend** (days + reason) → audited `PLATFORM_SUBSCRIPTION_EXTEND`
   - Platform **offline payment** capture (if cash/NEFT) → activates period
3. **Never** delete the clinic or patients to “clean up” an unpaid account.

---

## Platform actions (`SUPER_ADMIN` / `/platform`)

| Action | When to use |
|--------|-------------|
| Suspend | Abuse / non-payment policy (blocks access; data kept) |
| Reactivate | After suspend resolved |
| Extend | Goodwill / invoice delay / support commitment |
| Offline payment | Cash/cheque/NEFT recorded without Razorpay |
| Run job | `POST /api/v1/admin/jobs/:name/run` — expiry-check, payment-reminder, reconciliation |

All mutating actions write **audit** + `SubscriptionEvent`.

---

## Webhook / activation stuck

Symptoms: Razorpay shows paid, UI still `TRIALING` / `PAYMENT_REQUIRED`.

1. Check Razorpay Dashboard → Webhooks delivery to `https://api.sphearpro.tech/api/v1/webhooks/razorpay`.
2. Platform → webhooks list / DB `WebhookEvent` (`processed`, errors).
3. Run reconciliation job (dry-run unless `SUBSCRIPTION_RECONCILE_APPLY=true`).
4. Do **not** tell clinics that the Checkout success screen alone activates access.

---

## Common tickets

| Ticket | Resolution |
|--------|------------|
| “I paid but still locked” | Webhook/reconcile; never trust frontend-only confirm |
| “Doctor can’t open billing” | Expected — only clinic ADMIN |
| “We cancelled but still work” | Cancel-at-period-end until `currentPeriodEnd` |
| “Need 2 more weeks” | Platform extend with written reason |
| “Delete our data” | Separate compliance process — **not** automatic on expiry |

---

## Demo / local logins

See [`LOGIN.md`](../LOGIN.md). Change platform password in production after seed.
