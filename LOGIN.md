# SPHEAR demo logins

Local development only. Do **not** use these passwords in production.

**App:** http://localhost:3000  
**API:** http://localhost:4000/api/v1

Sign in with **email** and **password**.

## Public SaaS onboarding

| Page | URL |
|---|---|
| Pricing | http://localhost:3000/pricing |
| Clinic signup | http://localhost:3000/signup |

Signup creates a **new clinic** + ADMIN user, then routes toward checkout (`STANDARD` @ ₹1,500/mo). Activation requires a Razorpay webhook (or local `POST /subscription/activate` when configured for dev).

## Clinic admin (core seed)

Created by `prisma/seed.ts` on the **default** demo clinic. Override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` if you changed them.

| Name | Email | Password | Role |
|---|---|---|---|
| System Administrator | `admin@hislite.local` | `Admin@12345` | ADMIN |

Clinic SaaS billing UI: `/subscription` (ADMIN only).

## Platform super-admin

Created by seed when `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` are set (defaults below). Use **only** `/platform` — not clinic HIS modules.

| Name | Email | Password | Role |
|---|---|---|---|
| Platform Admin | `platform@hislite.local` | `Platform@12345` | SUPER_ADMIN |

Change this password immediately on any shared or production environment.

## Staff (Indian demo seed)

Created by `prisma/seed-demo-india.ts` on the default clinic. Shared password for all staff below: **`Staff@12345`**.

| Name | Email | Password | Role |
|---|---|---|---|
| Dr. Ananya Reddy | `ananya.reddy@hislite.local` | `Staff@12345` | DOCTOR |
| Dr. Vikram Iyer | `vikram.iyer@hislite.local` | `Staff@12345` | DOCTOR |
| Priya Sharma | `priya.sharma@hislite.local` | `Staff@12345` | RECEPTIONIST |
| Kavya Menon | `kavya.menon@hislite.local` | `Staff@12345` | BILLING |
| Rohit Gupta | `rohit.gupta@hislite.local` | `Staff@12345` | INVENTORY |

Doctors deliver therapy sessions — there is **no separate therapist login**. Doctors **cannot** manage SaaS subscription billing.

Patients (Aarav Sharma, etc.) do **not** have logins. There is no patient portal in v1.

## Related local services (not SPHEAR logins)

| Service | URL | User | Password |
|---|---|---|---|
| MinIO console | http://localhost:9001 | `minioadmin` | `minioadmin123` |
| Mailpit | http://localhost:8025 | — | — |
| Postgres | localhost:5432 | `hislite` | `hislite_dev_password` |
| Redis | localhost:6379 | — | — |

## Support

Subscription grace / expire / extend: [`docs/SUPPORT-SUBSCRIPTION.md`](docs/SUPPORT-SUBSCRIPTION.md)  
Launch checklist: [`docs/SAAS-LAUNCH-CHECKLIST.md`](docs/SAAS-LAUNCH-CHECKLIST.md)
