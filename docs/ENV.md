# HIS Lite — Environment variables

Copy [`.env.example`](../.env.example) to `.env` (repo root and/or `apps/api` as used locally). **Never commit real secrets.**

SaaS commercial locks: [`SAAS-DECISIONS.md`](./SAAS-DECISIONS.md).

---

## Application

| Variable | Purpose | Dev default / notes |
|----------|---------|---------------------|
| `NODE_ENV` | `development` \| `production` | `development` |
| `API_PORT` / `PORT` | Nest API port | `4000` |
| `WEB_PORT` | Vite / web | `3000` |
| `FRONTEND_URL` | CORS / links / cookies | `http://localhost:3000` |
| `API_URL` | Public API base (prod) | e.g. `https://api.hislite.in` |
| `OPENAPI_ENABLED` | Swagger | `true` in dev only |

---

## Database & Redis

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma PostgreSQL URL |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Compose Postgres |
| `REDIS_URL` / `REDIS_PORT` | BullMQ + cache |

Production: do not publish Postgres/Redis ports to the internet.

---

## Auth

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Access token signing (cryptographically random in prod) |
| `JWT_REFRESH_SECRET` | Refresh-related secrets if used |
| `JWT_EXPIRES_IN` | Access TTL (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh TTL (default `7d`) |
| `BCRYPT_ROUNDS` | Legacy name in env; API uses **Argon2** — keep for tooling compatibility |

---

## Rate limiting

| Variable | Purpose |
|----------|---------|
| `THROTTLE_TTL` | Window ms |
| `THROTTLE_LIMIT` | Max requests per window |
| `DISABLE_THROTTLE` | `true` only for local load tests |

---

## Object storage (MinIO / S3)

| Variable | Purpose |
|----------|---------|
| `S3_ENDPOINT` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credentials (**server only**) |
| `S3_BUCKET` | Clinic documents bucket |
| `S3_REGION` | Region string |

---

## Email

| Variable | Purpose |
|----------|---------|
| `MAIL_HOST` / `MAIL_PORT` | SMTP (Mailpit `localhost:1025` in dev) |
| `MAIL_USER` / `MAIL_PASS` | SMTP auth (empty for Mailpit) |
| `MAIL_FROM` | From address |
| `MAIL_SECURE` | `true` for TLS SMTP (prod) |
| `FRONTEND_URL` | Used in subscription email links |
| `SUBSCRIPTION_JOBS_DISABLED` | `true` to skip BullMQ repeatable jobs |
| `SUBSCRIPTION_RECONCILE_APPLY` | `true` to apply Razorpay↔DB status fixes (default dry-run) |

Production must use a real SMTP provider — not Mailpit.

---

## Seed admin (dev)

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Initial admin seed |

---

## WhatsApp / AI / observability

See `.env.example` for `WHATSAPP_*`, `GEMINI_*`, `ELEVENLABS_*`, `SENTRY_DSN`, `LOG_LEVEL`.

---

## SaaS subscription (Phase 0+ placeholders)

Used from Phase 5 onward. Leave empty until Razorpay is configured.

| Variable | Purpose | Exposed to browser? |
|----------|---------|---------------------|
| `RAZORPAY_KEY_ID` | Checkout key id (`rzp_test_…` or `rzp_live_…`) | Key id only may be sent to frontend when checkout starts |
| `RAZORPAY_KEY_SECRET` | Server API secret | **Never** |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature | **Never** |
| `RAZORPAY_PLAN_ID` | Razorpay plan id for `STANDARD` (₹1,800/mo) | Server only — create in Dashboard |
| `RAZORPAY_PLAN_ID_YEARLY` | Razorpay plan id for `STANDARD_YEARLY` (₹18,000/yr) | Server only |
| `RAZORPAY_SUBSCRIPTION_TOTAL_COUNT` | Provider billing cycles (default `120`) | Server only |
| `SUBSCRIPTION_ENFORCE` | `true`/`false` — SubscriptionGuard + FeatureGuard | Server (`false` = emergency bypass) |
| `SUBSCRIPTION_GRACE_DAYS` | Days after failed payment before expire | Server only (default **5**) |
| `SUBSCRIPTION_CURRENCY` | ISO currency | Server (default `INR`) |
| `SAAS_DEFAULT_PLAN_CODE` | Default highlighted plan code | Server (`STANDARD` — monthly ₹1,800) |
| `BACKUP_S3_ENDPOINT` | Off-VPS backup bucket endpoint | Server only |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` / `BACKUP_S3_BUCKET` | Backup credentials | **Never** to browser |
| `PLATFORM_ADMIN_EMAIL` | Optional bootstrap super-admin email | Seed (`platform@hislite.local`) |
| `PLATFORM_ADMIN_PASSWORD` | Bootstrap platform password | Seed only — change in prod |

**Test vs live:** Use Razorpay **test** keys in development. Switch to **live** keys only on the production VPS. Mode is inferred from the key id prefix (`rzp_test_` vs `rzp_live_`). Never put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in the React app or Vite env.

Webhook path (prod): `POST {API_URL}/api/v1/webhooks/razorpay`  
Header: `X-Razorpay-Signature` (required). Optional: `X-Razorpay-Event-Id`.  
Set `RAZORPAY_WEBHOOK_SYNC=true` to process webhooks inline (useful for local debugging without relying on the worker). Default is BullMQ queue `subscription` with exponential retries.

---

## Production VPS (Phase 11)

| Item | Location |
|------|----------|
| Prod compose | `docker-compose.prod.yml` (dev `docker-compose.yml` unchanged) |
| Secrets template | `.env.production.example` → VPS `.env.production` (never commit) |
| Runbook | [`docs/DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) |
| Edge nginx | `infrastructure/nginx/nginx.conf` (`app.` / `admin.` / `api.`) |
| TLS | `infrastructure/scripts/init-letsencrypt.sh`, `renew-certs.sh` |
| Backups | `infrastructure/scripts/backup-*.sh` + compose profile `backup` |

Required prod-only vars (also in `.env.production.example`):

| Variable | Notes |
|----------|--------|
| `CORS_ORIGIN` | Comma list; **required** when `NODE_ENV=production` |
| `REDIS_PASSWORD` | Redis `--requirepass` |
| `MAIL_*` | Real SMTP — Mailpit/localhost rejected by `MailService` in prod |
| `BACKUP_S3_*` | Off-VPS backup destination |

Public ports in prod compose: **80 / 443 only**. Postgres, Redis, MinIO, api, and web stay on the internal `hislite-network`.

---

## Git rules

Commit: `.env.example`, `.env.production.example`, this file.  
Do not commit: `.env`, `.env.production`, `apps/*/.env`, production secrets, Razorpay secrets, backup dumps, private keys.
