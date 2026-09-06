# SaaS Subscription ERD (Phase 2)

Brief schema note for the subscription domain. Clinical HIS `Invoice` / `Payment` are **separate**.

## Entities

```text
Clinic 1──* Subscription *──1 SubscriptionPlan
                │
                ├──* SubscriptionPayment
                ├──* SubscriptionInvoice
                └──* SubscriptionEvent

SubscriptionPlan 1──* PlanFeature *──1 Feature

WebhookEvent (provider + eventId unique; idempotency)
```

## Money

All SaaS amounts are **integer paise** (`monthlyPricePaise`, `amountPaise`, …). Currency default `INR`.

## Status lifecycle

`TRIALING → ACTIVE → PAST_DUE / PAYMENT_FAILED → GRACE_PERIOD → EXPIRED`  
Also: `CANCELLED`, `SUSPENDED`.

## MVP plan (seeded in Phase 3)

| Code | Price |
|------|-------|
| `STANDARD` | ₹1,800/month = `180000` paise |
| `STANDARD_YEARLY` | ₹1,500/mo display; ₹18,000/year = `1800000` paise per cycle |
| Seat limits | `maxStaffUsers` = 5, `maxAdminUsers` = 1 (both plans) |

Seed: `prisma/seed-subscription.ts` · API: `GET /api/v1/subscription/plans` · UI: `/pricing`

## Tables

| Table | Purpose |
|-------|---------|
| `subscription_plans` | Sellable plans |
| `features` / `plan_features` | Feature flags per plan |
| `subscriptions` | Clinic ↔ plan + Razorpay ids + period |
| `subscription_payments` | Provider payment records |
| `subscription_invoices` | SaaS invoices (`HIS-INV-…` style numbers later) |
| `webhook_events` | Idempotent webhook store |
| `subscription_events` | Audit trail of status/plan changes |

## Migration

`prisma/migrations/20260827120000_saas_subscription_domain/`

Apply with: `npx prisma migrate deploy`
