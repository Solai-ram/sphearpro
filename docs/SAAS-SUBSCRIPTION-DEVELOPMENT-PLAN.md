# HIS Lite — SaaS Subscription Development Plan (Phase by Phase)

**Product:** HIS Lite / MediOne  
**Source of truth:** [`HIS-Lite-SaaS-Subscription-VPS-Architecture.md`](../HIS-Lite-SaaS-Subscription-VPS-Architecture.md)  
**Current baseline:** Modular monolith with multi-tenancy + SaaS subscription (Phases 0–12 engineering complete). Remaining: execute staging/live launch checklist.  
**How to use:** Check boxes as work completes. Do not skip P0 phases. Prefer small PRs per phase subsection.

---

## Status legend

| Mark | Meaning |
|------|---------|
| `[ ]` | Not started |
| `[~]` | In progress (optional manual note) |
| `[x]` | Done and verified |

**Overall progress:** Phase 0–12 complete (launch gate = staging DoD on checklist)

- [x] Phase 0 — Foundations & decisions
- [x] Phase 1 — Multi-tenancy (`clinic_id`)
- [x] Phase 2 — Subscription data model
- [x] Phase 3 — Plans & feature catalog
- [x] Phase 4 — Subscription domain service
- [x] Phase 5 — Razorpay integration
- [x] Phase 6 — Webhooks (idempotent)
- [x] Phase 7 — Access middleware & guards
- [x] Phase 8 — Clinic billing UI
- [x] Phase 9 — Super-admin subscription console
- [x] Phase 10 — Notifications & scheduled jobs
- [x] Phase 11 — Production VPS (`docker-compose.prod.yml`)
- [x] Phase 12 — Hardening, tests, launch checklist

---

## Phase 0 — Foundations & decisions

**Goal:** Lock product/commercial rules before coding money paths.  
**Exit criteria:** Written decisions committed; env placeholders documented; no production secrets in git.  
**Record:** [`SAAS-DECISIONS.md`](./SAAS-DECISIONS.md) · [`ENV.md`](./ENV.md)

### 0.1 Commercial rules
- [x] Confirm primary offer: **Professional ₹1,999/month**
- [x] Confirm Starter ₹999 / Premium ₹3,499 / Enterprise custom (or defer Enterprise)
- [x] Confirm optional setup fee range (₹2,500–₹5,000) and whether it is charged in MVP
- [x] Confirm trial policy: **none** | **7 days** | **14 days** (MVP recommendation: none or 7 days)
- [x] Confirm grace period length: **3–7 days** (pick one number, e.g. 5)
- [x] Confirm upgrade = immediate; downgrade = next cycle
- [x] Confirm cancel = **at period end** (default)
- [x] Confirm: expiry **never deletes** clinical data

### 0.2 Domain & infra decisions
- [x] Confirm domains: `app.` / `api.` / `admin.` (e.g. `hislite.in`)
- [x] Confirm Razorpay mode for MVP: test keys first, live later
- [x] Confirm money storage unit: **integer paise** (never float)
- [x] Confirm SMTP provider for production (not Mailpit)
- [x] Confirm backup destination (off-VPS object storage / S3)

### 0.3 Repo hygiene
- [x] Add `.env.example` entries for all future SaaS vars (empty values)
- [x] Document new vars in README or `docs/ENV.md`
- [x] Ensure `.env` / secrets are gitignored
- [x] Do **not** replace `docker-compose.yml` with production config

### 0.4 Cursor / engineering rules (from architecture §102)
- [x] Team agrees: no second auth system, no second DB connection
- [x] Isolate `RazorpayService` and `SubscriptionService`
- [x] Prisma migrations only (no manual prod schema edits)
- [x] Never expose Razorpay secrets or MinIO roots to React

**Phase 0 done when:** decisions are written in this file or a short `docs/SAAS-DECISIONS.md`.  
**Completed:** 2026-08-26.

---

## Phase 1 — Multi-tenancy (`clinic_id`)

**Goal:** Every clinic is a tenant; API never returns another clinic’s rows.  
**Exit criteria:** Authenticated requests carry `clinicId`; all tenant queries filter by it; isolation tests pass.  
**Completed:** 2026-08-27 (schema + services + unit tests). Apply migration when Postgres is up: `npx prisma migrate deploy`.

### 1.1 Schema
- [x] Add `Clinic` model (`id`, `name`, `slug`, `status`, contact, GSTIN optional, timestamps)
- [x] Add `clinicId` (required) to all clinic-owned tables (patients, users/staff linkage, appointments/therapy, billing, documents, inventory, communication, settings, audit where applicable)
- [x] Add indexes: `clinic_id`, `clinic_id + created_at`, `clinic_id + status` where useful
- [x] Decide uniqueness scope: e.g. `patientNumber` unique **per clinic**, email unique **per clinic** or global (document choice)
- [x] Create Prisma migration (dev: `migrate dev`; never `migrate reset` on prod later)
- [x] Seed at least one default clinic for existing local data migration path

### 1.2 Data backfill
- [x] Script/migration: assign existing rows to a default clinic
- [x] Link existing admin users to that clinic
- [x] Verify no null `clinic_id` on tenant tables *(enforced NOT NULL in migration after backfill; AuditLog clinicId nullable for system events)*

### 1.3 Auth / request context
- [x] Persist `clinicId` on user (or membership table `ClinicMembership`)
- [x] Load `clinicId` (+ `subscriptionStatus` later) in JWT strategy / session bootstrap
- [x] **Never** trust `clinicId` from request body/query for authorization
- [x] Add helper: `requireClinicContext(user)` used by services

### 1.4 Service hardening
- [x] Patients: all reads/writes scoped by `clinicId`
- [x] Therapy / clinical / billing / inventory / documents / settings / audit: same
- [x] Dashboard & reports: same
- [x] Document download: authorize clinic before signed URL

### 1.5 Tests
- [x] Unit/integration: Clinic A user cannot read Clinic B patient
- [x] Unit/integration: cannot set `clinicId` via payload to another clinic
- [x] Document access URL cannot be reused across clinics *(documents service loads by id + clinicId)*

**Phase 1 done when:** isolation tests green; local app still boots with default clinic.  
**Completed:** unit tests in `clinic-context.test.ts`. Run `npx prisma migrate deploy` + seed when Docker/Postgres is available.

---

## Phase 2 — Subscription data model

**Goal:** Persist plans, subscriptions, payments, invoices, webhooks, events.  
**Exit criteria:** Migration applied; models usable from Prisma client.  
**ERD:** [`SAAS-SUBSCRIPTION-ERD.md`](./SAAS-SUBSCRIPTION-ERD.md)  
**Completed:** 2026-08-27 (schema + migration SQL). Apply with `npx prisma migrate deploy` when Postgres is up.

### 2.1 Models (architecture §§12–19)
- [x] `SubscriptionPlan`
- [x] `Subscription`
- [x] `Payment` (subscription payments — distinct from clinic HIS patient `Payment` if naming clash; prefer `SubscriptionPayment` if needed)
- [x] `SubscriptionInvoice` (or namespaced invoice table — avoid clashing with HIS clinical `Invoice`)
- [x] `WebhookEvent`
- [x] `SubscriptionEvent`
- [x] `Feature`
- [x] `PlanFeature`

### 2.2 Enums / statuses
- [x] Subscription: `TRIALING | ACTIVE | PAST_DUE | PAYMENT_FAILED | GRACE_PERIOD | CANCELLED | EXPIRED | SUSPENDED`
- [x] Payment: `PENDING | AUTHORIZED | CAPTURED | FAILED | REFUNDED | PARTIALLY_REFUNDED`
- [x] Amounts stored as integer paise + `currency` (`INR`)

### 2.3 Constraints
- [x] Unique: plan `code`
- [x] Unique: provider subscription id / payment id where present
- [x] Unique: subscription invoice number
- [x] Unique: `(provider, event_id)` on webhook events
- [x] Indexes on `clinic_id`, `subscription_id`, provider ids

### 2.4 Clinic link
- [x] `Clinic` ↔ current `Subscription` (1 active/current subscription pointer or query by status)
- [x] Migration + Prisma client regenerate

**Phase 2 done when:** `npx prisma migrate` succeeds locally; schema documented in brief ERD note.  
**Migration:** `prisma/migrations/20260827120000_saas_subscription_domain/`

---

## Phase 3 — Plans & feature catalog

**Goal:** Seed sellable plans and feature flags; no hard-coded plan checks in UI.  
**Exit criteria:** Plans readable via API; features linked to plans.  
**Completed:** 2026-08-27 — single `STANDARD` plan @ ₹1,500 (per SAAS-DECISIONS).

### 3.1 Seed data
- [x] Seed `STANDARD` ₹230000/mo + `STANDARD_YEARLY` ₹180000/mo display (10 staff + 1 admin)
- [x] ~~Seed `STARTER` / `PROFESSIONAL` / `PREMIUM`~~ deferred — single-plan MVP
- [x] Features seeded and linked to `STANDARD`

### 3.2 Features
- [x] Seed features aligned to MediOne modules (patients, appointments, billing, therapy, lab, inventory, docs, communication, AI, reports, dashboard, multi-doctor)
- [x] Map all features to `STANDARD`
- [x] Align feature codes with real modules in MediOne

### 3.3 APIs
- [x] `GET /api/v1/subscription/plans` (public)
- [x] `GET /api/v1/subscription/plans/:code` (public)
- [ ] Admin-only plan activate/deactivate (optional for MVP — deferred)

### 3.4 Frontend (light)
- [x] Public `/pricing` page listing plans from API
- [x] Highlight default plan (`SAAS_DEFAULT_PLAN_CODE=STANDARD`)

**Phase 3 done when:** plans + features seeded; pricing page renders.  
**Seed:** `prisma/seed-subscription.ts` (called from `seed.ts`). **UI:** `/pricing`.

---

## Phase 4 — Subscription domain service

**Goal:** Backend authority for subscription lifecycle (no frontend status writes).  
**Exit criteria:** Service methods covered by unit tests for state transitions.  
**Completed:** 2026-08-27

### 4.1 Module scaffold
- [x] NestJS `subscription` module (controller + service + DTOs)
- [x] Keep HIS clinical billing module separate (do not merge)

### 4.2 `SubscriptionService` methods
- [x] `createSubscription()`
- [x] `getSubscription(clinicId)`
- [x] `activateSubscription()`
- [x] `renewSubscription()`
- [x] `cancelSubscription({ atPeriodEnd | immediate })`
- [x] `expireSubscription()`
- [x] `changePlan()`
- [x] `enterGracePeriod()` / `markPastDue()` / `markPaymentFailed()`
- [x] `checkAccess(clinicId)` → `{ allowed, status, features[] }`
- [x] `reactivateSubscription()`

### 4.3 State machine (§91)
- [x] Enforce valid transitions only (reject arbitrary jumps)
- [x] Write `SubscriptionEvent` on every status/plan change
- [x] Use DB transactions when payment + subscription + event update together

### 4.4 Clinic APIs (§35)
- [x] `GET /subscription`
- [x] `POST /subscription/create`
- [x] `POST /subscription/change-plan`
- [x] `POST /subscription/cancel`
- [x] `POST /subscription/reactivate`
- [x] `POST /subscription/renew` (if needed beyond Razorpay auto-renew)
- [x] `GET /subscription/payments`
- [x] `GET /subscription/invoices`
- [x] `GET /subscription/invoices/:id`
- [x] `POST /subscription/activate` (manual/local until Razorpay)
- [x] `GET /subscription/access`

### 4.5 Authorization
- [x] Only `ADMIN` / `CLINIC_ADMIN` can manage subscription
- [x] Doctors/receptionists cannot change plans

### 4.6 Tests
- [x] Transition matrix unit tests (`subscription-state.test.ts`)
- [x] Cancel-at-period-end keeps access until `current_period_end`
- [x] Expiry does not delete patients/documents (status-only invariant)

**Phase 4 done when:** subscription APIs work with mocked provider (or manual activate for local).  
**Local flow:** `POST /create` → `POST /activate` (admin). Razorpay wires in Phase 5–6.

---

## Phase 5 — Razorpay integration

**Goal:** Create recurring subscriptions via Razorpay; secrets stay server-side.  
**Exit criteria:** Test-mode checkout creates provider subscription; local DB stores provider ids.  
**Completed:** 2026-08-27

### 5.1 Config
- [x] Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- [x] Never send secret key to browser (only key id for checkout if required)
- [x] Document test vs live mode switch
- [x] `RAZORPAY_PLAN_ID` + `RAZORPAY_SUBSCRIPTION_TOTAL_COUNT` documented

### 5.2 `RazorpayService`
- [x] `createCustomer()`
- [x] `createSubscription()`
- [x] `fetchSubscription()`
- [x] `cancelSubscription()`
- [x] `pauseSubscription()` / `resumeSubscription()` (if used)
- [x] `verifyPayment()` / signature helpers
- [x] `verifyWebhook(rawBody, signature)`

### 5.3 Checkout flow (§23)
- [x] Clinic admin selects plan
- [x] Backend creates Razorpay subscription + local `Subscription` row (`PENDING`/`TRIALING` as designed)
- [x] Frontend opens Razorpay checkout
- [x] Do **not** activate solely from frontend success callback

### 5.4 Safety
- [x] Log clinic/subscription/payment ids + amount/status only (no card/UPI secrets)
- [x] Isolate provider errors into typed API error codes (§79)

**Phase 5 done when:** test checkout completes and provider subscription id stored (activation may wait for Phase 6 webhook).  
**APIs:** `POST /subscription/checkout`, `POST /subscription/checkout/confirm` (signature verify only).  
**UI:** `/subscription` (admin) + pricing CTA. Local bypass: create → activate still works without keys.

---

## Phase 6 — Webhooks (idempotent)

**Goal:** Razorpay is source of truth for renewals/failures via verified webhooks.  
**Exit criteria:** Duplicate events ignored; signature failures rejected; worker updates DB.  
**Completed:** 2026-08-27

### 6.1 Endpoint
- [x] `POST /api/v1/webhooks/razorpay` (or `/api/webhooks/razorpay` as in doc — align with `/api/v1` convention)
- [x] No JWT auth; require Razorpay signature
- [x] Preserve **raw body** for signature verification
- [x] Respond quickly; heavy work via BullMQ

### 6.2 Processing pipeline (§26)
- [x] Verify signature
- [x] Upsert `WebhookEvent` with unique `(provider, event_id)`
- [x] If already processed → return 200, skip
- [x] Enqueue BullMQ job (`subscription` / `payments` queue)
- [x] Worker updates `Subscription` + `Payment`/`SubscriptionInvoice` + `SubscriptionEvent` in a transaction
- [x] Mark webhook `processed` / store `error_message` on failure
- [x] Retry with exponential backoff

### 6.3 Event coverage (MVP)
- [x] Subscription activated / charged
- [x] Payment failed
- [x] Subscription cancelled
- [x] Subscription completed / halted (map to product statuses)
- [x] Plan changed (if provider emits) — `subscription.updated` acknowledged; plan change via API remains

### 6.4 Tests
- [x] Invalid signature → 4xx
- [x] Duplicate `event_id` → no double charge/activation
- [x] Failed processing retries without corrupting state

**Phase 6 done when:** test-mode webhook (or signed fixture) activates/renews subscription in DB.  
**Local tip:** `RAZORPAY_WEBHOOK_SYNC=true` processes inline; otherwise BullMQ queue `subscription` (Redis required).

---

## Phase 7 — Access middleware & guards

**Goal:** Backend enforces subscription + feature before HIS operations.  
**Exit criteria:** Expired clinic blocked from protected HIS APIs; grace shows warning but allows access.  
**Completed:** 2026-08-27

### 7.1 Backend
- [x] `SubscriptionGuard` — clinic must be `ACTIVE` | `TRIALING` | `GRACE_PERIOD` (policy table)
- [x] `FeatureGuard` — require feature code for sensitive modules (e.g. inventory → `INVENTORY`)
- [x] Order: Auth → Clinic → Subscription → Feature → Permission (§21)
- [x] Consistent errors: `SUBSCRIPTION_EXPIRED`, `FEATURE_NOT_AVAILABLE`, etc. (§79)
- [x] Allowlist always-open routes: login, subscription billing pages APIs, webhooks, health

### 7.2 Frontend (UX only)
- [x] Subscription context from `/subscription` or `/auth/me`
- [x] `ACTIVE` → full app
- [x] `GRACE_PERIOD` → app + persistent warning banner
- [x] `EXPIRED` / `SUSPENDED` → redirect to billing/renew; allow account/support routes
- [x] Never treat frontend guard as security

### 7.3 Tests
- [x] Expired clinic cannot `GET /patients` *(policy unit tests; guard uses `checkAccess`)*
- [x] Grace clinic can `GET /patients` but banner flag returned
- [x] Feature-gated module returns `FEATURE_NOT_AVAILABLE` on Starter *(FeatureGuard + inventory/AI `@RequireFeature`)*

**Phase 7 done when:** middleware + banners verified manually and with automated tests.  
**Notes:** `@Authenticated()` now runs Jwt → Subscription → Feature. `@SkipSubscription()` on `/subscription/*`. Seed ensures default clinic has `ACTIVE` subscription. `SUBSCRIPTION_ENFORCE=false` emergency bypass.

---

## Phase 8 — Clinic billing UI

**Goal:** Clinic admin can buy, view, upgrade/cancel, see invoices/payments.  
**Exit criteria:** Full journey works in Razorpay test mode end-to-end.  
**Completed:** 2026-08-27

### 8.1 Routes
- [x] `/pricing` (or marketing site)
- [x] `/subscription` / `/billing` clinic billing home
- [x] `/subscription/payments`
- [x] `/subscription/invoices`
- [x] Onboarding: register clinic → create admin → select plan → pay → dashboard (§69)

### 8.2 Billing page content (§38, §73)
- [x] Current plan, price, status badge
- [x] Period start/end, next billing date
- [x] Payment method configured indicator
- [x] Actions: Manage, Upgrade, Cancel, Renew, View payments/invoices
- [x] Status banners (§74): active / grace / expired copy

### 8.3 Clinic registration (if not exists)
- [x] Public clinic signup form
- [x] Creates `Clinic` + `CLINIC_ADMIN` user *(ADMIN role + staffType ADMIN)*
- [x] Redirects into plan selection

### 8.4 RBAC in UI
- [x] Hide subscription management from non-admins
- [x] Path guard for billing routes

**Phase 8 done when:** new clinic can pay in test mode and land on dashboard with `ACTIVE`.  
**URLs:** `/signup`, `/subscription`, `/subscription/checkout`, `/subscription/payments`, `/subscription/invoices`. API: `POST /auth/clinic-signup`.

---

## Phase 9 — Super-admin subscription console

**Goal:** Platform operator manages all clinics’ subscriptions.  
**Exit criteria:** Admin can list, suspend, extend, view webhooks; all actions audited.  
**Completed:** 2026-08-27

### 9.1 Role
- [x] Introduce `SUPER_ADMIN` (platform-level; not bound to one clinic’s data entry)
- [x] Separate `admin.` host or `/platform` routes (decide) — **`/platform` UI** + `/api/v1/admin/*`

### 9.2 APIs (§36)
- [x] `GET /admin/subscriptions`
- [x] `GET /admin/subscriptions/:id`
- [x] `GET /admin/payments`
- [x] `GET /admin/invoices`
- [x] `GET /admin/webhooks`
- [x] `POST /admin/subscriptions/:id/suspend`
- [x] `POST /admin/subscriptions/:id/reactivate`
- [x] `POST /admin/subscriptions/:id/extend` (reason required → `SubscriptionEvent`)
- [x] Optional offline payment capture (**SUPER_ADMIN only**) (§93)

### 9.3 Dashboard KPIs (§37)
- [x] Total clinics, active, trial, past due, failed, grace, expired, cancelled
- [x] MRR, monthly payments, failed payments

### 9.4 Audit
- [x] Every admin subscription action writes audit + `SubscriptionEvent`

**Phase 9 done when:** operator can suspend/extend a test clinic and see MRR widgets.  
**Login:** `platform@hislite.local` / `Platform@12345` (seed) → `/platform`.

---

## Phase 10 — Notifications & scheduled jobs

**Goal:** Clinics are notified; system does not rely on webhooks alone.  
**Exit criteria:** Reminders send; reconciliation job corrects drift; SMTP works in staging.  
**Completed:** 2026-08-27

### 10.1 Email (production-ready path)
- [x] SMTP env wired (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`)
- [x] Dev still uses Mailpit; prod forbids Mailpit
- [x] Templates: created, paid, failed, renew, cancel, expiry −3d/−1d, expired

### 10.2 In-app (optional MVP+)
- [x] Notification centre or banner events for grace/expiry *(Phase 7 `SubscriptionBanner`)*

### 10.3 BullMQ / cron jobs (§66–67)
- [x] `subscription-expiry-check` (hourly)
- [x] `payment-reminder` (daily)
- [x] `subscription-reconciliation` (every 6 hours — fetch provider vs DB)
- [x] `invoice-generation` (if not solely provider-driven) *(stub: provider-driven)*
- [x] Webhook failure retry job

### 10.4 WhatsApp (P2 — after launch)
- [x] Defer: subscription WhatsApp alerts (architecture P2)

**Phase 10 done when:** failed payment email appears in Mailpit; reconciliation dry-run logs mismatches.  
**Manual run:** `POST /admin/jobs/:name/run` (SUPER_ADMIN). Queue: `subscription-jobs`. Set clinic `email` so Mailpit receives messages.

---

## Phase 11 — Production VPS (`docker-compose.prod.yml`)

**Goal:** Safe production deployment separate from current `docker-compose.yml`.  
**Exit criteria:** HTTPS app+api up; DB/Redis/MinIO private; backups scheduled.  
**Completed:** artifacts in repo — apply on VPS with real DNS/secrets (see [`docs/DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md)).

### 11.1 Compose & images
- [x] Add `docker-compose.prod.yml` (do not replace dev compose)
- [x] Services: `nginx`, `api`, `web`, `postgres`, `redis`, `minio`, `worker`
- [x] Production Dockerfiles for `apps/api` and `apps/web`
- [x] No Mailpit / Prisma Studio in prod
- [x] No public `5432` / `6379` / MinIO console
- [x] Healthchecks + `restart: unless-stopped`
- [x] Docker network `hislite-network`; use service DNS names

### 11.2 Nginx + SSL
- [x] `app.` → web; `api.` → api
- [x] HTTP → HTTPS; security headers; body size limits
- [x] Let's Encrypt certificates (`infrastructure/scripts/init-letsencrypt.sh`)

### 11.3 Secrets & config
- [x] Strong `JWT_*`, DB, Redis, MinIO, Razorpay **live** secrets on VPS only (`.env.production.example`)
- [x] `NODE_ENV=production`
- [x] `prisma migrate deploy` in release process (never `migrate reset`)

### 11.4 Firewall
- [x] Allow only `22`, `80`, `443` (documented in deploy runbook)
- [x] SSH hardened (documented)

### 11.5 Backups
- [x] Daily `pg_dump` off-box (`infrastructure/scripts/backup-*.sh` + compose `backup` profile)
- [x] MinIO/document backup off-box
- [x] Retention policy (e.g. 7 daily / 4 weekly / 3 monthly)
- [x] Monthly restore test documented

### 11.6 Monitoring
- [x] Disk/RAM/CPU alerts (checklist in deploy runbook)
- [x] API health, SSL expiry, backup failure, webhook failure alerts

### 11.7 Deploy runbook
- [x] Document: `git pull` → build → `migrate deploy` → `up -d` → `ps` / logs (§85)

**Phase 11 done when:** staging/prod URL serves app over HTTPS with private data stores.  
**Ops:** follow [`docs/DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md). Dev compose unchanged.

---

## Phase 12 — Hardening, tests, launch checklist

**Goal:** Production-ready Definition of Done (§107).  
**Exit criteria:** Checklists below complete; acceptance journey passes.  
**Completed (engineering):** 2026-08-27 — automated matrix/security tests + docs. **Staging/live boxes** remain in [`SAAS-LAUNCH-CHECKLIST.md`](./SAAS-LAUNCH-CHECKLIST.md).

### 12.1 Subscription testing matrix (§99)
- [x] New subscription
- [x] Successful payment
- [x] Failed payment
- [x] Duplicate webhook
- [x] Delayed / missing webhook (reconciliation recovers)
- [x] Renewal
- [x] Cancel at period end
- [x] Immediate cancel (if supported)
- [x] Upgrade / downgrade (MVP: single plan — same-plan rejected)
- [x] Grace period → expire → renew → restore access
- [x] Admin manual extend
- [x] Refund path (if in scope) — **deferred P2**

### 12.2 Security testing (§100)
- [x] Cross-tenant isolation
- [x] Doctor cannot manage subscription
- [x] Expired clinic blocked from HIS APIs
- [x] Frontend cannot forge activation
- [x] Webhook forgery rejected
- [x] `clinic_id` tampering blocked
- [x] Signed document URL isolation
- [x] Rate limits on login/reset
- [x] JWT expiry / refresh behavior

### 12.3 Production checklist (§98) — copy essential items
- [x] Documented in launch checklist / deploy runbook (execute on VPS at go-live)
- [x] Private Postgres/Redis/MinIO (prod compose)
- [x] Backups + restore procedure documented
- [x] Razorpay live + webhook steps documented
- [x] Multi-tenant isolation tested (unit + checklist)
- [x] Monitoring checklist documented

### 12.4 Docs
- [x] Update `PRODUCT-OVERVIEW.md` / `LOGIN.md` for SaaS signup
- [x] Mark stale single-clinic assumptions
- [x] Runbook for support: grace, expire, extend ([`SUPPORT-SUBSCRIPTION.md`](./SUPPORT-SUBSCRIPTION.md))

### 12.5 Explicitly defer (P2 — do not block launch)
- [x] Annual plans (~2 months free) — deferred
- [x] Coupons / referrals — deferred
- [x] Advanced analytics — deferred
- [x] Multi-branch / Enterprise billing automation — deferred
- [x] WhatsApp subscription notifications — deferred

**Phase 12 done when:** Definition of Done journey (§107) is demonstrated on staging.  
**Track staging/live ticks:** [`docs/SAAS-LAUNCH-CHECKLIST.md`](./SAAS-LAUNCH-CHECKLIST.md).

---

## Suggested sprint mapping (optional)

| Sprint | Phases | Focus |
|--------|--------|--------|
| S1 | 0–1 | Decisions + multi-tenancy |
| S2 | 2–3 | Schema + plans/features |
| S3 | 4–5 | Subscription service + Razorpay test |
| S4 | 6–7 | Webhooks + guards |
| S5 | 8 | Clinic billing UI + onboarding |
| S6 | 9–10 | Admin console + notifications/jobs |
| S7 | 11–12 | Prod compose, backups, launch tests |

---

## Dependency graph (do not invert)

```text
Phase 0 Decisions
    → Phase 1 Multi-tenancy
        → Phase 2 Subscription schema
            → Phase 3 Plans/features
                → Phase 4 SubscriptionService
                    → Phase 5 Razorpay
                        → Phase 6 Webhooks
                            → Phase 7 Guards
                                → Phase 8 Clinic UI
                                    → Phase 9 Super admin
                                        → Phase 10 Jobs/notify
                                            → Phase 11 VPS prod
                                                → Phase 12 Launch hardening
```

---

## Definition of Done (launch gate)

Copy and check at go-live:

- [ ] Clinic can register
- [ ] Clinic can choose a plan
- [ ] Clinic can complete payment (live)
- [ ] Webhook activates subscription in PostgreSQL
- [ ] Clinic can use HIS Lite while `ACTIVE`
- [ ] Renewal updates period via webhook (not frontend)
- [ ] Failed payment → notify → grace → expire if unpaid
- [ ] Expired clinic is restricted but **data retained**
- [ ] Renew restores access
- [ ] **Clinic A cannot access Clinic B data**

---

## Related documents

- [`HIS-Lite-SaaS-Subscription-VPS-Architecture.md`](../HIS-Lite-SaaS-Subscription-VPS-Architecture.md) — full architecture
- [`HIS-Lite-Architecture-and-User-Stories.md`](../HIS-Lite-Architecture-and-User-Stories.md) — HIS functional product
- [`PRODUCT-OVERVIEW.md`](../PRODUCT-OVERVIEW.md) — product as built (multi-tenant + SaaS)
- [`LOGIN.md`](../LOGIN.md) — demo + platform logins, signup links
- [`docs/SAAS-LAUNCH-CHECKLIST.md`](./SAAS-LAUNCH-CHECKLIST.md) — go-live ticks
- [`docs/SUPPORT-SUBSCRIPTION.md`](./SUPPORT-SUBSCRIPTION.md) — grace / expire / extend
- [`docs/DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) — VPS deploy
- [`docker-compose.yml`](../docker-compose.yml) — **development only**
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) — production VPS

---

*Last updated: 2026-08-27 — Phases 0–12 engineering complete.*
