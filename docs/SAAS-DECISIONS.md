# HIS Lite SaaS — Phase 0 Decisions

**Status:** Locked for MVP implementation  
**Date:** 2026-08-26 (revised same day — single plan)  
**Authority:** [`HIS-Lite-SaaS-Subscription-VPS-Architecture.md`](../HIS-Lite-SaaS-Subscription-VPS-Architecture.md)  
**Plan:** [`SAAS-SUBSCRIPTION-DEVELOPMENT-PLAN.md`](./SAAS-SUBSCRIPTION-DEVELOPMENT-PLAN.md)

Change these only with an explicit product decision (edit this file + note the date). Do not silently diverge in code.

---

## 0.1 Commercial rules

| Decision | Locked value | Notes |
|----------|--------------|--------|
| Plans in MVP | **One Standard plan, two billing cycles** | Hostinger-style: same product; monthly vs yearly toggle |
| Plan codes | **`STANDARD`** (monthly), **`STANDARD_YEARLY`** (annual) | Same features and seat limits |
| Monthly price | **₹2,300/month** | Stored as `230000` paise; plan code `STANDARD` |
| Annual price | **₹1,800/month effective** | **₹21,600/year** (`2160000` paise/cycle); code `STANDARD_YEARLY`; display `180000` paise/mo |
| Seat limits | **10 staff + 1 admin** | Enforced on user create; `maxStaffUsers` / `maxAdminUsers` on plan |
| Enterprise / multi-tier | **Deferred** | Custom / multi-plan later if needed |
| Currency | **INR** | Store amounts as **integer paise** |
| Setup / onboarding fee | **Optional, not required in MVP checkout** | Catalogue later: ₹2,500–₹5,000; configurable |
| Data migration / custom work | **Out of band** | Quoted separately; not in Razorpay plan |
| Trial | **None in MVP** | Add 7-day trial only after monthly billing is stable |
| Grace period | **5 days** | After payment failure before EXPIRED |
| Upgrade / downgrade | **Billing interval only** | Same tier; monthly ↔ yearly via checkout |
| Cancel default | **Cancel at period end** | Immediate cancel only via support/super-admin if needed |
| Expiry data policy | **Never delete clinical data** | Restrict HIS access only; retain patients, docs, audits |

### Plan price → paise (canonical)

| Plan code | Display (per month) | Charged per cycle | Cycle paise | Display paise/mo |
|-----------|---------------------|-------------------|-------------|------------------|
| `STANDARD` | ₹2,300 | monthly | `230000` | `230000` |
| `STANDARD_YEARLY` | ₹1,800 | yearly (₹21,600) | `2160000` | `180000` |

Never use floating-point for money.

---

## 0.2 Domain & infrastructure

| Decision | Locked value |
|----------|--------------|
| Public product domains (prod / demo) | `sphearpro.tech`, `api.sphearpro.tech` (www optional) |
| Billing mode (demo) | Razorpay **test** keys + test plan IDs until real charges |
| Webhook URL (prod / demo) | `https://api.sphearpro.tech/api/v1/webhooks/razorpay` |
| Razorpay for MVP / demo | **Test mode keys** (`rzp_test_*`) on sphearpro.tech; live keys only when charging real customers |
| Money unit | Integer **paise** + `currency = INR` |
| Dev email | Mailpit (current compose) |
| Prod email | Real SMTP (`MAIL_*` env) — provider chosen at deploy time (e.g. SES, Resend, Zoho) |
| Backup destination | **Off-VPS** S3-compatible bucket (separate from clinic MinIO app bucket) |
| Dev compose | Keep existing `docker-compose.yml` unchanged as **development only** |
| Prod compose | `docker-compose.prod.yml` (Phase 11) — **do not replace** dev compose |
| Auth hashing | Keep existing **Argon2** in API (do not introduce a second hasher) |
| Auth tokens | Keep JWT access + opaque refresh cookie pattern already in HIS Lite |

---

## 0.3 Naming collisions (HIS clinic billing vs SaaS billing)

HIS Lite already has clinical **`Invoice`** / **`Payment`** for patient billing.

SaaS subscription tables will use distinct names to avoid Prisma/API clashes:

| SaaS concept | Preferred Prisma model name |
|--------------|-----------------------------|
| Subscription invoice | `SubscriptionInvoice` |
| Subscription payment | `SubscriptionPayment` |
| Clinic tenant | `Clinic` |
| SaaS plan | `SubscriptionPlan` |

API routes for SaaS live under `/api/v1/subscription/*` and `/api/v1/admin/subscriptions/*` (and webhook path above). Do not overload `/billing` (patient HIS billing).

---

## 0.4 Multi-tenancy (Phase 1)

| Decision | Locked value |
|----------|--------------|
| Tenant key | `clinicId` on all clinic-owned root rows |
| User ↔ clinic | **`User.clinicId`** (one clinic per user) |
| Email uniqueness | **Global** on `User.email` |
| Trust boundary | Backend derives clinic from authenticated user — **never** from client-supplied `clinicId` |
| Existing local data | Backfill into one **default clinic** (`slug: default`) |
| Platform operator | `SUPER_ADMIN` (Phase 9) — not a normal clinic staff role |
| RBAC catalog | `Role` / `Permission` stay **global** (no `clinicId`) |

---

## 0.5 Access policy (feeds Phase 7)

| Subscription status | App access | UX |
|---------------------|------------|-----|
| `TRIALING` | Full (when trials enabled) | Optional trial badge |
| `ACTIVE` | Full | Quiet status / billing page |
| `GRACE_PERIOD` | Full | Persistent warning banner |
| `PAST_DUE` / `PAYMENT_FAILED` | Treat as entering grace per worker rules | Notify + banner |
| `EXPIRED` / `SUSPENDED` / `CANCELLED` (after period) | **Restricted** — login + subscription/billing/support only | Renew CTA |
| Data on expiry | **Retained** | No hard delete |

Feature flags come from `PlanFeature` (Phase 3), not hard-coded plan names in React.

---

## 0.6 Engineering rules (non-negotiable)

1. Inspect existing project before large changes; do not rewrite HIS modules unnecessarily.
2. One auth system, one Prisma/DB connection.
3. Isolate `SubscriptionService` and `RazorpayService`.
4. Prisma migrations only — never `migrate reset` on production.
5. Webhooks: verify signature → idempotent by `(provider, event_id)` → then update DB.
6. Frontend payment success is **not** authority; webhooks/backend are.
7. Never expose Razorpay secret, webhook secret, JWT secrets, or MinIO root credentials to React.
8. Never delete clinical data when a subscription expires.
9. Keep payment provider logic and subscription state machine testable in isolation.
10. Document every new environment variable in [`ENV.md`](./ENV.md) and `.env.example`.

---

## 0.7 Explicitly out of MVP (do not build in Phases 1–8)

- Multi-tier plans (Starter / Professional / Premium)
- Annual plans
- Coupons / referrals
- Multi-branch automation
- WhatsApp for subscription notices (email first)
- Enterprise self-serve checkout
- Setup fee as mandatory Razorpay line item

---

## 0.8 Phase 0 exit checklist

- [x] Commercial rules written here
- [x] Domain / infra decisions written here
- [x] SaaS env placeholders in `.env.example`
- [x] Env vars documented in `docs/ENV.md`
- [x] `.env` / secrets remain gitignored
- [x] Dev `docker-compose.yml` not replaced by prod config
- [x] Engineering rules acknowledged in this file
- [x] Standard plan: ₹2,300/mo or ₹1,800/mo on annual; 10 staff + 1 admin locked

**Phase 0 complete (revised).** Next: **Phase 1 — Multi-tenancy (`clinic_id`)**.

---

*To revise a locked value: update this table, bump the date, and note why in a one-line changelog below.*

### Changelog

| Date | Change |
|------|--------|
| 2026-08-26 | Initial Phase 0 lock (multi-tier from architecture doc) |
| 2026-08-31 | Revised pricing: ₹1,800/mo or ₹1,500/mo annual; `STANDARD_YEARLY`; 5 staff + 1 admin seats |
| 2026-09-09 | Revised pricing: ₹2,300/mo or ₹1,800/mo annual (₹21,600/yr); 10 staff + 1 admin seats |
