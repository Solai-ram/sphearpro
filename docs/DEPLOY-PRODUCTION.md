# Production deployment runbook (Phase 11)

**Product:** HIS Lite / MediOne  
**Compose file:** [`docker-compose.prod.yml`](../docker-compose.prod.yml) — **do not** replace [`docker-compose.yml`](../docker-compose.yml) (dev).  
**Secrets template:** [`.env.production.example`](../.env.production.example) → copy to `.env.production` on the VPS only.

Domains (see `docs/SAAS-DECISIONS.md`):

| Host | Role |
|------|------|
| `sphearpro.tech` / `www.sphearpro.tech` | Clinic SPA (+ `/platform` admin) |
| `api.sphearpro.tech` | Nest API + Razorpay webhooks |

Demo note: Razorpay **test** keys (`rzp_test_*`) are acceptable for test/demo on this host. Use live keys only when charging real customers.

**DNS:** [sphearpro.tech](http://sphearpro.tech/) must point at your VPS (A/AAAA). Until then Hostinger may show a parked page.

---

## 1. VPS prerequisites

- Ubuntu 22.04+ (or similar), Docker Engine + Compose v2
- DNS A/AAAA for `app` / `admin` / `api` → VPS public IP
- Open inbound **22, 80, 443** only

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### SSH hardening (minimum)

- Key-based auth; disable password login when keys work
- Optional: change SSH port / fail2ban
- Never expose Postgres `5432`, Redis `6379`, or MinIO `9000`/`9001` on the public interface (this compose does not publish them)

---

## 2. First-time setup

```bash
git clone <repo> his-lite && cd his-lite
cp .env.production.example .env.production
# Edit .env.production: JWT_*, POSTGRES_PASSWORD, REDIS_PASSWORD,
# MINIO_*, MAIL_*, RAZORPAY live keys, BACKUP_S3_*
chmod 600 .env.production
```

### TLS (Let's Encrypt)

```bash
export CERTBOT_EMAIL=ops@yourdomain.com
# Optional: CERTBOT_STAGING=1 for a dry run
chmod +x infrastructure/scripts/*.sh
./infrastructure/scripts/init-letsencrypt.sh
```

### Build, migrate, start

```bash
./infrastructure/scripts/deploy.sh
# or manually (§85):
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  npx prisma migrate deploy --schema=prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production --profile backup up -d
```

**Never** run `prisma migrate reset` on production.

### Seed (once, if needed)

Prefer seeding from a controlled ops session with Node + `DATABASE_URL` pointed at the private network (SSH tunnel or `docker compose run` with a **builder** image that includes `ts-node`). The slim production API image is not meant for interactive seed. Change `PLATFORM_ADMIN_PASSWORD` after first login.

### Razorpay webhook

Dashboard → Webhooks (Test mode) → `https://api.sphearpro.tech/api/v1/webhooks/razorpay`  
Events: subscription + payment (as configured in Phase 6). Secret → `RAZORPAY_WEBHOOK_SECRET`.

---

## 3. Routine deploy (§85)

```bash
./infrastructure/scripts/deploy.sh
# Logs:
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Health:

- Internal: `GET http://api:4000/api/v1/health`
- Public: `https://api.sphearpro.tech/api/v1/health`

---

## 4. Backups

| Job | Schedule | Script |
|-----|----------|--------|
| Postgres `pg_dump` | Daily 02:00 UTC (compose `backup` profile) | `infrastructure/scripts/backup-postgres.sh` |
| MinIO documents | Same run | `infrastructure/scripts/backup-minio.sh` |
| TLS renew | Host cron 2×/day | `infrastructure/scripts/renew-certs.sh` |

Retention defaults: **7 daily / 4 weekly / 3 monthly** (override via `BACKUP_RETENTION_*`).

Off-box: set `BACKUP_S3_*` so dumps leave the VPS. **Do not** rely on local volume alone.

Enable backup service:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production --profile backup up -d
```

### Monthly restore test

1. Provision a scratch Postgres (compose override or separate host).
2. `RESTORE_CONFIRM=YES POSTGRES_HOST=… POSTGRES_DB=hislite_restore \
   ./infrastructure/scripts/restore-postgres.sh /path/to/dump.sql.gz`
3. Verify row counts for `Clinic`, `Patient`, `Subscription`.
4. Point a staging API at the restore DB and hit `/api/v1/health`.
5. Record date + result in the ops log.

---

## 5. Monitoring checklist

Configure an external uptime/alert provider (UptimeRobot, Better Stack, Grafana Cloud, etc.):

| Check | Target | Alert if |
|-------|--------|----------|
| API health | `https://api.sphearpro.tech/api/v1/health` | non-200 / `status!=ok` |
| App HTTPS | `https://sphearpro.tech/` | non-200 |
| SSL expiry | app + api certs | &lt; 14 days |
| Disk | VPS root + Docker volume mount | &gt; 80% |
| RAM / CPU | host metrics | sustained &gt; 90% |
| Backup | last success mtime under backup volume / S3 | &gt; 36h old |
| Webhooks | platform admin webhook failures / Mail alerts | any sustained failure |

Optional: set `SENTRY_DSN` for API errors.

Host cron example (TLS):

```cron
0 3,15 * * * cd /opt/his-lite && ./infrastructure/scripts/renew-certs.sh >> /var/log/hislite-certs.log 2>&1
```

---

## 6. What must stay private

- Postgres, Redis, MinIO: **no** public ports (enforced in `docker-compose.prod.yml`)
- No Mailpit / Prisma Studio in prod compose
- Razorpay / JWT / DB / SMTP secrets: VPS `.env.production` only
- Clinical data: never deleted on subscription expiry (product rule)

---

## 7. Rollback (brief)

```bash
git checkout <previous-sha>
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
# DB: restore last known-good dump only if a migration is unsafe — prefer forward fix
```

---

## 8. Local smoke (optional)

You cannot fully validate public HTTPS without DNS. You can still:

```bash
docker compose -f docker-compose.prod.yml config
# Validate YAML + interpolation with a filled .env.production
```

Full image build requires Docker on the machine and is heavy (npm ci × api/web).
