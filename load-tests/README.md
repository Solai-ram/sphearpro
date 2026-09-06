# HIS-Lite / MediOne load tests (k6)

Simulates clinic traffic against the NestJS API so you can see what happens under load (including **~200 concurrent users**).

## Prerequisites

1. **API running** on `http://localhost:4000` (Postgres + Redis up, seed data loaded).
2. **[k6](https://k6.io/docs/get-started/installation/)** installed:

```powershell
winget install Grafana.k6
# or: choco install k6
```

3. **Disable/raise rate limiting** for the test run (all VUs share one IP, so the default 100 req/min would only measure the throttler):

```powershell
# In .env (or apps/api/.env), then restart the API:
DISABLE_THROTTLE=true
```

Or temporarily: `THROTTLE_LIMIT=100000`

## Scripts

| File | What it measures | Default load |
|---|---|---|
| `clinic-browse.js` | Logged-in staff browsing patients, doctor sessions, billing, dashboard | Ramp to **200 VUs** |
| `login-storm.js` | Concurrent Argon2 logins | ~50 VUs |
| `ai-summary.js` | Gemini summarize (costly / slow) | 3 VUs — opt-in only |

## Run

From the repo root:

```powershell
# Smoke (~5 users)
npm run load:smoke

# Main clinic mix → 200 concurrent users
npm run load:clinic

# Sudden spike to 200
npm run load:spike

# Login storm
npm run load:login

# AI (uses provider quota — keep small)
npm run load:ai
```

Or call k6 directly:

```powershell
k6 run -e PROFILE=smoke load-tests/clinic-browse.js
k6 run -e PROFILE=clinic -e BASE_URL=http://localhost:4000 load-tests/clinic-browse.js
k6 run -e PROFILE=spike load-tests/clinic-browse.js
k6 run -e VUS=100 -e DURATION=1m load-tests/login-storm.js
k6 run -e VUS=3 -e CASE_ID=<uuid> load-tests/ai-summary.js
```

## How to read results

- **http_req_failed** — should stay under ~5% for `clinic-browse` (thresholds enforce this).
- **http_req_duration p(95)** — target under 2s for normal CRUD; AI is allowed much longer.
- **checks** — business assertions (login got a token, lists returned 2xx).
- Many **429** responses → you forgot `DISABLE_THROTTLE=true`.
- Rising latency / 5xx near 200 VUs → API or Postgres pool saturation (expected bottleneck area).

## Demo credentials

Uses accounts from `LOGIN.md` (`admin@hislite.local`, `ananya.reddy@hislite.local`, etc.). Override with `-e DOCTOR_EMAIL=...` if needed.

## After testing

Set `DISABLE_THROTTLE=false` (or remove it) and restart the API so production-like rate limits are back.

## Docker alternative (no local k6)

```powershell
npm run load:smoke:docker
npm run load:clinic:docker
```

Uses `host.docker.internal:4000` to reach the API on Windows Docker Desktop.
