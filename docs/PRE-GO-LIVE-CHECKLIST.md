# SPHEAR — Pre–go-live checklist

**Product:** SPHEAR (HIS-Lite clinic CRM)  
**Demo host:** [sphearpro.tech](http://sphearpro.tech/) · API: `api.sphearpro.tech`  
**Billing mode for this launch:** Razorpay **test** keys (demo/test only — OK)  
**Last updated:** 2026-09-06 (agent progress pass)

Related: [`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) · [`DEPLOY-VPS-GUIDE.md`](./DEPLOY-VPS-GUIDE.md) (beginner VPS walkthrough) · [`SAAS-LAUNCH-CHECKLIST.md`](./SAAS-LAUNCH-CHECKLIST.md) · [`ENV.md`](./ENV.md) · [`SUPPORT-SUBSCRIPTION.md`](./SUPPORT-SUBSCRIPTION.md)

**Local verify anytime:** `node scripts/verify-pre-go-live.cjs`

---

## Progress summary (2026-09-06)

| Bucket | Status |
|--------|--------|
| Launch scope decisions | **Done** |
| Code gates (trial, WhatsApp off, activate blocked in prod, cookies) | **Done** (verified by tests + script) |
| Local env: Razorpay test keys + plan IDs + trial + enforce flags | **Done** |
| Generated VPS secrets file | **Done** → `.env.production.secrets.local` (gitignored) |
| Automated subscription / webhook / access tests | **Done** (38+ critical tests passing) |
| Local API health + plans catalogue | **Done** (`/health` ok, 2 SPHEAR plans) |
| DNS / VPS / TLS / deploy | **You** — Hostinger still parked |
| Razorpay Dashboard webhook secret | **You** |
| Real SMTP + password rotation on VPS | **You** |
| Full clinic UAT on demo host | **You** (after DNS) |

---

## Status at a glance

| Area | Built? | Ready for demo host? |
|------|--------|----------------------|
| Clinic HIS (patients, OP, therapy, appointments, lab, billing, inventory, docs, AI, reports) | Yes | After UAT on host |
| Auth + RBAC + audit | Yes | Change seed passwords on VPS |
| SaaS signup / pricing / Razorpay 7-day trial | Yes | Needs webhook + DNS |
| Platform admin (`/platform`) | Yes | Change platform password on VPS |
| WhatsApp | Code present, **disabled in v1** | Skip |
| Production Docker / nginx / backups | Scripts exist | Must run on VPS |
| Automated test coverage | Thin overall; billing/subscription paths covered | Staging UAT still mandatory |
| DNS / TLS for sphearpro.tech | Not cut over yet | **Blocker (you)** |

---

## 0. Decide launch scope (do this first)

- [x] Confirm this release is **demo / test only** (no real customer charges).
- [x] Confirm Razorpay stays on **test mode** (`rzp_test_*` + current plan IDs).
- [x] Confirm WhatsApp stays **off** for v1 (`WHATSAPP_ENABLED=false`).
- [x] Confirm domains: app = `sphearpro.tech`, API = `api.sphearpro.tech`.
- [x] Prefer **HTTPS** even for demos (Let’s Encrypt). Plain HTTP is temporary only.

---

## 1. Infrastructure & DNS (blockers) — **you**

Today [sphearpro.tech](http://sphearpro.tech/) still shows a Hostinger parked page until DNS points at your VPS.

- [ ] Provision VPS (Ubuntu 22.04+, Docker + Compose v2).
- [ ] Firewall: allow **22 / 80 / 443** only; do **not** expose Postgres, Redis, or MinIO publicly.
- [ ] DNS A/AAAA records:
  - [ ] `sphearpro.tech` → VPS
  - [ ] `www.sphearpro.tech` → VPS (optional redirect)
  - [ ] `api.sphearpro.tech` → VPS
- [ ] Wait for DNS propagation; verify parked page is gone.
- [ ] TLS certificates (`infrastructure/scripts/init-letsencrypt.sh`).
- [ ] Copy `.env.production.example` → `.env.production` on the VPS (`chmod 600`).
- [x] Template prepared locally: `.env.production.example` (sphearpro.tech + test Razorpay plan IDs).
- [x] Strong secrets generated for paste into VPS: `.env.production.secrets.local` (gitignored).
- [ ] Merge secrets into VPS `.env.production` (JWT, DB, Redis, MinIO, platform password).
- [ ] Deploy: `docker compose -f docker-compose.prod.yml --env-file .env.production …` (see [`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md)).
- [ ] Run `prisma migrate deploy` (never `migrate reset` on this host).
- [ ] Enable backup profile + off-VPS `BACKUP_S3_*` if possible.
- [ ] Document one successful backup restore drill.

---

## 2. Environment & secrets

### Required — local / template (agent)

- [x] Production URL template: `FRONTEND_URL` / `API_URL` / `CORS_ORIGIN` for sphearpro.tech (in `.env.production.example`).
- [x] Strong JWT / DB / Redis / MinIO / platform password **generated** (`.env.production.secrets.local`).
- [x] `SUBSCRIPTION_ENFORCE=true` (local `.env` + api `.env` + production example).
- [x] `ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE=false` (local + production example + controller gate).
- [x] `OPENAPI_ENABLED=false` / `WHATSAPP_ENABLED=false` set in local env files + example.

### Required — VPS (you)

- [ ] `NODE_ENV=production` on VPS.
- [ ] Apply `FRONTEND_URL` / `API_URL` / `CORS_ORIGIN` on VPS.
- [ ] Paste generated secrets onto VPS (do not commit them).
- [ ] Real SMTP (`MAIL_*`) on VPS — not Mailpit.

### Razorpay (test/demo OK)

- [x] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test) in local env.
- [x] `RAZORPAY_MONTHLY_PLAN_ID=plan_TYeFsYg2ghqgZh`
- [x] `RAZORPAY_YEARLY_PLAN_ID=plan_TYeZQ1svuDpVLO`
- [x] `RAZORPAY_TRIAL_DAYS=7`
- [x] Frontend public key only: `apps/web/.env` → `VITE_RAZORPAY_KEY_ID` (no secret).
- [ ] `RAZORPAY_WEBHOOK_SECRET` **set** (still empty locally — **you** create webhook in Dashboard and paste secret to VPS).
- [ ] Webhook URL in Razorpay Dashboard (Test mode):  
  `https://api.sphearpro.tech/api/v1/webhooks/razorpay`
- [ ] Webhook events enabled:  
  `subscription.authenticated`, `subscription.activated`, `subscription.charged`,  
  `subscription.pending`, `subscription.halted`, `subscription.cancelled`,  
  `subscription.completed`, `payment.failed`

### Optional but recommended

- [x] `GEMINI_API_KEY` / `ELEVENLABS_API_KEY` present in local `.env` (for AI demos).
- [ ] `SENTRY_DSN` for error tracking (optional).
- [x] Documented: production must **not** set `SUBSCRIPTION_JOBS_DISABLED=true` (local API may use it for dev only).

---

## 3. Accounts & security hardening

### Verified in code / tests (agent)

- [x] Only clinic billing admins can manage subscription (unit test).
- [x] Refresh cookie is httpOnly + `sameSite=strict`; `secure` when `NODE_ENV=production` (policy test).
- [x] Access token kept in memory; legacy localStorage keys cleared (`apps/web/src/lib/api.ts`).
- [x] Manual `POST /subscription/activate` blocked when `NODE_ENV=production` unless allow-flag.
- [x] WhatsApp UI route / nav / worker gated off for v1.

### You on VPS / demo host

- [ ] Change platform admin password after first seed (`PLATFORM_ADMIN_*` — use value from secrets file).
- [ ] Change default clinic seed passwords (`Admin@12345`, `Staff@12345`, etc. — see `LOGIN.md`).
- [ ] Create a real clinic via `/signup` (do not rely only on seed tenants for demos).
- [ ] Spot-check **cross-clinic isolation** on the live host.
- [ ] Confirm Helmet / CORS behave on the public host.

---

## 4. SaaS subscription & billing

### Verified locally / in code (agent)

- [x] `/pricing` CTA = **Start 7-Day Free Trial**; copy includes `7 days free · Then ₹…`.
- [x] Checkout CTA = **Start 7-Day Free Trial**.
- [x] Plans API returns `STANDARD` + `STANDARD_YEARLY` named **SPHEAR Standard**.
- [x] Razorpay subscription create sends `start_at` (= now + 7 days) — unit tested.
- [x] Confirm verifies signature and does **not** set `ACTIVE` (webhook authority) — lifecycle tested.
- [x] Trial window (`trialEnd`) opens only after successful confirm — abandoned checkout stays blocked.
- [x] Invalid webhook signature rejected — webhook unit tests.
- [x] Duplicate webhook idempotent — webhook unit tests.
- [x] `subscription.activated` → local ACTIVE path — lifecycle / webhook tests.
- [x] Failed payment / grace / cancel / expire paths covered in lifecycle / access tests.
- [x] Local health: `GET /api/v1/health` → ok + database connected.

### You after DNS + webhook

- [ ] `/signup` creates clinic + admin on demo host.
- [ ] Full Checkout in browser with Razorpay test card.
- [ ] Confirm **no plan charge today** in Razorpay Dashboard.
- [ ] Billing page shows trial days remaining.
- [ ] Webhook deliveries succeed in Dashboard.
- [ ] First activation / charge updates local subscription as expected.
- [ ] Cancel at period end keeps access until period end (manual).
- [ ] Closing Checkout before pay does **not** grant HIS access (manual confirm on host).

---

## 5. Clinic product UAT (walk the whole app) — **you on demo host**

Run as clinic admin (and spot-check as doctor where noted) **after** DNS serves the app.

### Auth

- [ ] Login / logout
- [ ] Forgot password + reset email (needs SMTP)
- [ ] Session refresh after access token expiry

### Patients & OP

- [ ] Register patient
- [ ] Search / open patient timeline
- [ ] Create OP / clinical visit
- [ ] Upload document
- [ ] Print/view OP registration receipt if used

### Appointments

- [ ] Create appointment / assign doctor
- [ ] Calendar / day board / slots
- [ ] Confirm reception flow via Appointments (no separate Reception module)

### Therapy

- [ ] Create therapy case
- [ ] Assign package / patient package
- [ ] Auto-generated sessions
- [ ] Mark attendance (Present / Absent / etc.)
- [ ] SOAP-style therapist note (doctor session workspace)
- [ ] AI draft note → **human review → approve** (never silent write)

### Lab

- [ ] Create lab procedure / billable test
- [ ] Lab dashboard status

### Clinic billing (patient invoices — not SaaS)

- [ ] Create invoice (OP / therapy / product)
- [ ] Record payment / receipt
- [ ] Print invoice
- [ ] Basic billing / revenue reports

### Inventory

- [ ] Item master
- [ ] Stock entry
- [ ] Sale / return request
- [ ] Low stock / stock report

### Documents

- [ ] Upload, list, open with permission
- [ ] Confirm signed URL / access is clinic-scoped

### AI

- [ ] Transcribe (if ElevenLabs configured)
- [ ] Summarize / note draft
- [ ] Review queue — approve/edit before clinical save
- [ ] Usage / audit entry visible where expected

### Reports & dashboard

- [ ] Dashboard loads without errors
- [ ] Clinical / therapy / financial / inventory report pages
- [ ] Export if offered

### Admin

- [ ] Users: invite/create staff within seat limits
- [ ] Roles & permissions (custom role if demo needs it)
- [ ] Audit log shows sensitive actions
- [ ] Settings / appearance

### Platform admin

- [ ] Login to `/platform`
- [ ] List clinics / subscriptions
- [ ] View payments / invoices / webhooks
- [ ] Extend / suspend / offline payment (ops tools) — use carefully on demo data

---

## 6. Explicitly out of scope for this launch (do not block)

- [x] WhatsApp messaging UI / worker — **disabled / skipped**
- [x] Patient portal / mobile apps — deferred
- [x] Live Razorpay keys / real card charges — not for this demo
- [x] Multi-branch / multi-clinic product model — deferred
- [x] Insurance, NABH/NABL, FHIR/HL7, external HIS/LIS — deferred
- [x] Teleconsultation — deferred
- [x] Coupons / referral billing — deferred
- [x] Automated refunds — deferred
- [x] Full E2E Playwright suite — not present
- [x] Production CD — GitHub deploy jobs are stubs

---

## 7. Quality & ops before inviting guests

### Agent / local

- [x] Local smoke health: `http://127.0.0.1:4000/api/v1/health` → ok.
- [x] Critical automated tests green: subscription lifecycle, Razorpay service, webhooks, access, auth cookie policy (38+ tests this pass).
- [x] Local verify script: `node scripts/verify-pre-go-live.cjs` → 19 passed, 0 failed, 1 skipped (webhook secret).
- [x] Support cheat-sheet present: [`SUPPORT-SUBSCRIPTION.md`](./SUPPORT-SUBSCRIPTION.md).

### You

- [ ] Public health: `https://api.sphearpro.tech/api/v1/health`
- [ ] App loads: `https://sphearpro.tech/` (not Hostinger park page)
- [ ] CI green on main (optional baseline)
- [ ] Optional load-tests against staging
- [ ] Monitoring: uptime, disk, SSL, webhook failures
- [ ] One person knows how to read Razorpay webhook logs + API logs

### Known engineering debt (aware)

- API statement coverage ~**25%** overall — **manual UAT is mandatory**.
- Frontend tests are minimal.
- Docs drift: ignore stale “spec only / no code” notes in `CLAUDE.md` for launch decisions.

---

## 8. Definition of Done — demo go-live gate

1. [ ] DNS serves SPHEAR (not Hostinger park page). — **you**
2. [ ] HTTPS works for app + API. — **you**
3. [ ] New clinic can sign up and start a **7-day free trial** with Razorpay test Checkout. — **you** (code ready)
4. [ ] Trial clinic can use core HIS (patients + therapy / OP / billing). — **you**
5. [ ] Webhooks verify (secret set; Dashboard shows successful deliveries). — **you**
6. [ ] Seed/platform passwords changed. — **you** (secrets generated)
7. [ ] SMTP delivers at least password-reset or subscription email. — **you**
8. [ ] Two-clinic isolation spot-checked. — **you**
9. [x] WhatsApp remains off without broken nav/errors. — **verified in code**
10. [ ] Someone can restore a DB backup if the demo host is wiped. — **you**

---

## 9. Suggested order of work (remaining)

1. **You:** VPS + DNS + TLS for `sphearpro.tech` / `api.sphearpro.tech`
2. **You:** Create Razorpay **test** webhook + paste `RAZORPAY_WEBHOOK_SECRET`
3. **You:** Copy `.env.production.example` + `.env.production.secrets.local` → VPS `.env.production`
4. **You:** Deploy compose + migrate + seed; rotate any remaining seed passwords
5. **You:** SaaS trial smoke in browser
6. **You:** Clinic UAT (section 5)
7. **You:** Backup restore drill
8. Invite external demo users

---

## Agent completed this session (artifacts)

| Artifact | Purpose |
|----------|---------|
| `docs/PRE-GO-LIVE-CHECKLIST.md` | This file (ticked) |
| `scripts/verify-pre-go-live.cjs` | Re-runnable local gate check |
| `.env.production.example` | Demo host template (sphearpro.tech) |
| `.env.production.secrets.local` | Generated JWT/DB/Redis/MinIO/platform password (**gitignored**) |
| Local `.env` / `apps/api/.env` | `ALLOW_MANUAL_…=false`, `WHATSAPP_ENABLED=false`, `OPENAPI_ENABLED=false` |
| Unit tests | Subscription + webhook + access + cookie policy |

---

## Quick reference — key URLs

| What | URL |
|------|-----|
| App | `https://sphearpro.tech` |
| API | `https://api.sphearpro.tech/api/v1` |
| Health | `https://api.sphearpro.tech/api/v1/health` |
| Pricing | `https://sphearpro.tech/pricing` |
| Signup | `https://sphearpro.tech/signup` |
| Platform | `https://sphearpro.tech/platform` |
| Razorpay webhook | `https://api.sphearpro.tech/api/v1/webhooks/razorpay` |

---

*Tick remaining boxes on the demo host as you finish them. Re-run `node scripts/verify-pre-go-live.cjs` after env changes.*
