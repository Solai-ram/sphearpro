# SaaS launch checklist (Phase 12)

Use this on **staging first**, then production. Automated coverage lives in API/web unit tests; items marked **Manual** need a human on a live environment.

Related: [`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) · [`SUPPORT-SUBSCRIPTION.md`](./SUPPORT-SUBSCRIPTION.md) · [`SAAS-DECISIONS.md`](./SAAS-DECISIONS.md)

---

## 12.1 Subscription testing matrix (§99)

| Scenario | Automated | Manual (staging/live) | Notes |
|----------|-----------|----------------------|--------|
| New subscription | ✅ lifecycle + checkout | ☐ Signup → `/pricing` → checkout | Creates `TRIALING` until webhook |
| Successful payment | ✅ `applyProviderActivated` | ☐ Razorpay test/live charge | Webhook activates |
| Failed payment | ✅ → `GRACE_PERIOD` | ☐ Fail card / simulate fail | Email via Mailpit/SMTP |
| Duplicate webhook | ✅ webhook service | ☐ Replay same `event_id` | Idempotent skip |
| Delayed / missing webhook | ✅ reconcile status map | ☐ Confirm UI then wait / run reconcile job | `POST /admin/jobs/subscription-reconciliation/run` |
| Renewal | ✅ `applyProviderCharged` | ☐ Wait billing cycle or Dashboard charge | Period end advances |
| Cancel at period end | ✅ flag + access | ☐ Clinic cancel | Access until `currentPeriodEnd` |
| Immediate cancel | ✅ → `CANCELLED` | ☐ If exposed in UI/admin | Blocks HIS |
| Upgrade / downgrade | ✅ same-plan reject | Billing interval switch | `STANDARD` ↔ `STANDARD_YEARLY` via new checkout |
| Grace → expire → renew | ✅ matrix | ☐ Force expire job then repay | Data retained |
| Admin manual extend | ✅ platform extend | ☐ `/platform` extend | Audited |
| Refund path | Deferred P2 | — | Not in MVP scope |

---

## 12.2 Security testing (§100)

| Scenario | Automated | Manual |
|----------|-----------|--------|
| Cross-tenant isolation | ✅ clinic-context + invoice/doc scope | ☐ Two clinics, attempt cross IDs |
| Doctor cannot manage subscription | ✅ `assertClinicBillingAdmin` + RBAC | ☐ Doctor UI hides `/subscription` |
| Expired clinic blocked from HIS APIs | ✅ SubscriptionGuard | ☐ Expire then hit `/patients` |
| Frontend cannot forge activation | ✅ `confirmCheckout` → `activated: false` | ☐ Confirm success UI without webhook |
| Webhook forgery rejected | ✅ bad signature → 401 | ☐ Curl without valid HMAC |
| `clinic_id` tampering blocked | ✅ confirm mismatch + tenant helpers | ☐ Body `clinicId` ignored on creates |
| Signed document URL isolation | ✅ documents tenancy | ☐ Clinic A URL/id from Clinic B |
| Rate limits on login/reset | ✅ `THROTTLE_POLICY` wired | ☐ Burst login → 429 |
| JWT expiry / refresh | ✅ cookie policy (httpOnly/secure) | ☐ Expire access, refresh cookie works |

---

## 12.3 Production checklist (§98)

- [ ] VPS, Docker, firewall (22/80/443), DNS, HTTPS ([`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md))
- [ ] Private Postgres / Redis / MinIO (no public ports)
- [ ] Backups enabled (`--profile backup`) + off-VPS `BACKUP_S3_*`
- [ ] Monthly restore test logged
- [ ] Razorpay **test** keys (demo OK) + webhook `https://api.sphearpro.tech/api/v1/webhooks/razorpay` verified
- [ ] DNS for `sphearpro.tech` + `api.sphearpro.tech` pointing at VPS (not Hostinger park page)
- [ ] Multi-tenant isolation tested on staging
- [ ] Monitoring: API health, SSL expiry, disk, backup freshness, webhook failures
- [ ] Real SMTP (not Mailpit)
- [ ] Platform admin password changed from seed default

---

## Definition of Done (§107) — go-live gate

- [ ] Clinic can register (`/signup`)
- [ ] Clinic can choose plan (`STANDARD` @ ₹1,800/mo or `STANDARD_YEARLY` @ ₹1,500/mo effective)
- [ ] Clinic can complete payment (live)
- [ ] Webhook activates subscription in PostgreSQL
- [ ] Clinic can use HIS Lite while `ACTIVE`
- [ ] Renewal updates period via webhook (not frontend)
- [ ] Failed payment → notify → grace → expire if unpaid
- [ ] Expired clinic is restricted but **data retained**
- [ ] Renew restores access
- [ ] **Clinic A cannot access Clinic B data**

---

## Explicitly deferred (P2 — do not block launch)

- Annual plans (~2 months free)
- Coupons / referrals
- Advanced analytics
- Multi-branch / Enterprise billing automation
- WhatsApp subscription notifications
- Refund automation

---

*Phase 12 engineering artifacts: unit tests under `apps/api` / `apps/web`; ops runbooks above. Staging demonstration closes the launch gate.*
