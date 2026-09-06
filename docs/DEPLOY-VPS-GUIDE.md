# SPHEAR — Deploy on your Ubuntu VPS (step by step)

You have: **Ubuntu VPS** + domain **sphearpro.tech** (still parked until DNS is set).  
Goal: run the demo app with Razorpay **test** keys.

If your image is labeled “Ubuntu 26 LTS”, that’s fine — these steps work on current Ubuntu LTS releases (22.04 / 24.04 / 26.x).

Do the steps **in order**. Copy-paste each block on the VPS (SSH).

---

## What you will end up with

| URL | Purpose |
|-----|---------|
| https://sphearpro.tech | Clinic app (+ `/platform` for platform admin) |
| https://api.sphearpro.tech | API + Razorpay webhooks |
| https://api.sphearpro.tech/api/v1/health | Health check |

---

## Step 1 — Point DNS at the VPS (Hostinger)

1. On the VPS, find your public IP:
   ```bash
   curl -4 ifconfig.me
   ```
2. In **Hostinger → Domains → sphearpro.tech → DNS / DNS Zone**:
   - **A** `@` (sphearpro.tech) → your VPS IP  
   - **A** `www` → same IP  
   - **A** `api` → same IP  
3. Remove/disable any Hostinger “parked” / parking redirect if present.
4. Wait 5–30 minutes. Check from your PC:
   ```bash
   nslookup sphearpro.tech
   nslookup api.sphearpro.tech
   ```
   Both should show your VPS IP (not Hostinger parking).

**Do not continue to TLS until DNS is correct.**

---

## Step 2 — SSH into the VPS

From your Windows PC (PowerShell):

```powershell
ssh root@YOUR_VPS_IP
```

(Use your real user if not `root`.)

---

## Step 3 — Install Docker

On the VPS:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo docker run --rm hello-world
```

If the Docker repo fails on a brand-new Ubuntu codename, install Docker from Ubuntu’s packages instead:

```bash
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

---

## Step 4 — Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 5 — Get the code on the VPS

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone YOUR_REPO_URL his-lite
cd /opt/his-lite
```

If the repo is private, use a GitHub deploy key or paste a zip / `git clone` with a token.

If you develop only on your Windows machine and have no remote yet:

1. Create a GitHub repo and push from Windows.
2. Then `git clone` on the VPS.

---

## Step 6 — Create `.env.production`

```bash
cd /opt/his-lite
cp .env.production.example .env.production
nano .env.production
```

### Must set

| Variable | What to put |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong password (from your local `.env.production.secrets.local` if you have it) |
| `REDIS_PASSWORD` | Strong password |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Strong values |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Long random strings |
| `PLATFORM_ADMIN_PASSWORD` | Strong password — **remember it** |
| `RAZORPAY_KEY_ID` | Your test key `rzp_test_…` |
| `RAZORPAY_KEY_SECRET` | Your test secret |
| `RAZORPAY_MONTHLY_PLAN_ID` | `plan_TYeFsYg2ghqgZh` |
| `RAZORPAY_YEARLY_PLAN_ID` | `plan_TYeZQ1svuDpVLO` |
| `RAZORPAY_WEBHOOK_SECRET` | Leave empty for now → fill in Step 10 |
| `MAIL_*` | Real SMTP if you want password-reset emails (can finish later) |

Confirm these stay:

```text
FRONTEND_URL=https://sphearpro.tech
API_URL=https://api.sphearpro.tech
CORS_ORIGIN=https://sphearpro.tech,http://sphearpro.tech,https://www.sphearpro.tech,http://www.sphearpro.tech,https://api.sphearpro.tech
SUBSCRIPTION_ENFORCE=true
ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE=false
```

Lock the file:

```bash
chmod 600 .env.production
```

**Tip:** On Windows you already have `.env.production.secrets.local` — open it, copy values into the VPS file (never commit that file).

---

## Step 7 — TLS certificates (HTTPS)

```bash
cd /opt/his-lite
chmod +x infrastructure/scripts/*.sh
export CERTBOT_EMAIL=your-real-email@example.com
./infrastructure/scripts/init-letsencrypt.sh
```

If Let’s Encrypt complains about rate limits during practice, retry with:

```bash
export CERTBOT_STAGING=1
./infrastructure/scripts/init-letsencrypt.sh
```

(Staging certs show a browser warning; for a real demo, use the normal command once DNS is solid.)

---

## Step 8 — Build, migrate, start

```bash
cd /opt/his-lite
./infrastructure/scripts/deploy.sh
```

Or manually:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  npx prisma migrate deploy --schema=prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

**Never** run `prisma migrate reset` on this server.

### Seed (first time only)

If login users don’t exist yet, seed from a one-off container (depends on your seed script). Typical pattern:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  sh -c 'npx prisma db seed --schema=prisma/schema.prisma'
```

If seed isn’t wired in the image, use the method in [`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) (ops container / SSH tunnel). After seed, **change** platform and clinic passwords.

---

## Step 9 — Smoke check

On the VPS:

```bash
curl -fsS https://api.sphearpro.tech/api/v1/health
curl -fsSI https://sphearpro.tech/
```

In your browser:

1. Open https://sphearpro.tech/pricing  
2. Open https://sphearpro.tech/signup  
3. Log in and open **Subscription → Checkout**

---

## Step 10 — Razorpay webhook (required for real activations)

1. Razorpay Dashboard → **Test mode** → **Webhooks** → Add.
2. URL: `https://api.sphearpro.tech/api/v1/webhooks/razorpay`
3. Enable events:  
   `subscription.authenticated`, `subscription.activated`, `subscription.charged`,  
   `subscription.pending`, `subscription.halted`, `subscription.cancelled`,  
   `subscription.completed`, `payment.failed`
4. Copy the **webhook secret**.
5. On VPS:
   ```bash
   nano /opt/his-lite/.env.production
   # set RAZORPAY_WEBHOOK_SECRET=whsec_...
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d api worker
   ```

---

## Step 11 — Demo login checklist

1. Create a clinic via **/signup** (preferred for demos).  
2. Or use seeded admin — then **change password immediately**.  
3. Start **7-Day Free Trial** with a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/).  
4. Confirm trial access to Patients / Therapy.  
5. Platform: https://sphearpro.tech/platform  

Full product walkthrough: [`PRE-GO-LIVE-CHECKLIST.md`](./PRE-GO-LIVE-CHECKLIST.md) section 5.

---

## Useful commands

```bash
cd /opt/his-lite

# Status
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f nginx

# Redeploy after git pull
./infrastructure/scripts/deploy.sh

# Restart one service
docker compose -f docker-compose.prod.yml --env-file .env.production restart api
```

---

## If something fails

| Symptom | Likely fix |
|---------|------------|
| Site still “Parked Domain” | DNS not pointed / not propagated |
| Certbot “connection refused / unauthorized” | DNS wrong, or ports 80/443 blocked |
| App loads but login API fails | `CORS_ORIGIN` / `FRONTEND_URL` mismatch |
| Checkout works but never activates | Missing `RAZORPAY_WEBHOOK_SECRET` or webhook URL |
| 502 Bad Gateway | `docker compose … logs api` — API not healthy yet |
| Out of disk | `df -h` — prune old images: `docker system prune -a` |

---

## What you do vs what is already done in the repo

| Done in repo | You do on VPS |
|--------------|---------------|
| App + Docker compose + nginx for sphearpro.tech | DNS + Docker install |
| Trial + Razorpay test plan IDs | `.env.production` secrets |
| Deploy / cert scripts | Run cert + deploy |
| Pre-go-live checklist | Webhook + browser UAT |

---

*After Step 9 works, tick section 1 of [`PRE-GO-LIVE-CHECKLIST.md`](./PRE-GO-LIVE-CHECKLIST.md).*
