# HIS Lite — SaaS Subscription, Billing & VPS Production Architecture

**Product:** HIS Lite  
**Product Type:** Clinic-focused Hospital Information System (HIS) SaaS  
**Deployment:** VPS using Docker / Docker Compose  
**Frontend:** React + Vite  
**Backend:** Node.js API  
**Database:** PostgreSQL 16  
**ORM:** Prisma  
**Cache / Queue:** Redis 7 + BullMQ  
**File Storage:** MinIO / S3-compatible storage  
**Reverse Proxy:** Nginx  
**Payments:** Razorpay Subscriptions  
**SSL:** Let's Encrypt  
**Target Market:** Clinics and small healthcare organizations in India

---

## 1. Objective

HIS Lite will be sold to clinics using a recurring monthly SaaS subscription model.

The system must support:

- Clinic registration
- Subscription plan selection
- Monthly recurring billing
- Online payment
- Payment verification
- Razorpay webhook processing
- Subscription activation
- Subscription renewal
- Payment failure handling
- Grace period
- Subscription expiry
- Subscription cancellation
- Plan upgrade
- Plan downgrade
- Payment history
- Invoice records
- Subscription status checks
- Feature-based access control
- Clinic-level multi-tenancy
- Admin subscription management
- Automated reminders
- Automated subscription reconciliation
- Secure VPS deployment
- Database backup
- File backup
- Audit logging

---

## 2. Existing HIS Lite Technology Stack

```text
Frontend
React
Vite

Backend
Node.js API

Database
PostgreSQL 16
Prisma ORM

Cache / Queue
Redis 7
BullMQ

Object/File Storage
MinIO
S3-compatible API

Email
Mailpit in development
Production SMTP provider in production

Containerization
Docker
Docker Compose

Development
Docker Compose

Production
VPS + Docker Compose + Nginx + SSL
```

---

## 3. Important Production Rule

The current `docker-compose.yml` is a **development configuration**.

Do NOT deploy it directly to production.

Development-only services/settings include:

- Mailpit
- Prisma Studio
- Development volume mounts
- `npm run start:dev`
- Vite development server
- Public PostgreSQL port
- Public Redis port
- Public MinIO console
- Default passwords
- Default JWT secrets
- Development email configuration

Use a separate production file:

```text
docker-compose.prod.yml
```

Recommended project structure:

```text
docker-compose.yml
docker-compose.prod.yml
.env
.env.example
```

---

## 4. Production Architecture

```text
                         INTERNET
                            |
                         HTTPS :443
                            |
                         NGINX
                            |
              +-------------+-------------+
              |                           |
        React Frontend                Node API
                                          |
                              +-----------+-----------+
                              |           |           |
                         PostgreSQL     Redis       MinIO
                              |           |           |
                           Prisma      BullMQ      Documents
                                          |
                                       Worker
```

Payment flow:

```text
Clinic
  |
  v
HIS Lite Web
  |
  v
Node API
  |
  v
Razorpay
  |
  v
Payment / Subscription
  |
  v
Razorpay Webhook
  |
  v
Node API Webhook Endpoint
  |
  v
PostgreSQL
  |
  v
Subscription Status
```

---

## 5. VPS Specification

Initial VPS:

```text
CPU:       2 vCPU
RAM:       8 GB
Storage:   100 GB NVMe
Bandwidth: 8 TB
```

This is reasonable for the initial SaaS stage if the application and database are optimized.

Scale later if required:

```text
2 vCPU / 8 GB
      ↓
4 vCPU / 16 GB
      ↓
Separate DB server
      ↓
Load-balanced application servers
```

---

## 6. Domain Structure

Recommended:

```text
hislite.in
www.hislite.in

app.hislite.in
api.hislite.in
admin.hislite.in
```

Examples:

```text
https://app.hislite.in
https://api.hislite.in
https://admin.hislite.in
```

Payment webhook:

```text
https://api.hislite.in/api/webhooks/razorpay
```

---

## 7. Multi-Tenant Architecture

Each clinic is a tenant.

```text
Clinic A
 ├── Users
 ├── Doctors
 ├── Patients
 ├── Appointments
 ├── Billing
 ├── Documents
 └── Subscription

Clinic B
 ├── Users
 ├── Doctors
 ├── Patients
 ├── Appointments
 ├── Billing
 ├── Documents
 └── Subscription
```

Every clinic-owned table must contain:

```text
clinic_id
```

Example:

```text
patients
---------
id
clinic_id
name
phone
date_of_birth
...
```

The API must never return records belonging to another clinic.

---

## 8. Tenant Isolation

Every authenticated request should identify:

```text
user_id
clinic_id
role
subscription_status
```

The backend must always filter by `clinic_id`.

Correct:

```sql
SELECT *
FROM patients
WHERE clinic_id = authenticatedUser.clinicId;
```

Incorrect:

```sql
SELECT *
FROM patients;
```

Do not trust `clinic_id` received directly from the frontend.

The backend must derive the clinic from the authenticated user/session.

---

# 9. Subscription Plans

## Starter

**₹999/month**

Target:

- Small clinics
- Single-doctor clinics

Suggested features:

- Patient registration
- Patient search
- Appointment management
- Basic doctor management
- Basic billing
- Basic reports
- Basic dashboard
- Cloud storage
- Backup
- Email notifications
- Software updates

---

## Professional

**₹1,999/month**

This should be the primary HIS Lite plan.

Suggested features:

- Everything in Starter
- Advanced patient records
- EMR
- Prescription management
- Doctor management
- Staff management
- Advanced billing
- Reports
- Document management
- Dashboard analytics
- Appointment reports
- Payment history
- Automated reminders
- Priority support

---

## Premium

**₹3,499/month**

Target:

- Growing clinics
- Multi-doctor clinics

Suggested features:

- Everything in Professional
- Multiple doctors
- Advanced reports
- Inventory
- Advanced billing
- Additional users
- Advanced dashboard
- Priority support
- Additional storage
- Advanced clinic configuration

---

## Enterprise

Custom pricing.

Possible features:

- Multiple branches
- Multi-location support
- Custom workflows
- Custom integrations
- Dedicated support
- Custom reports
- Custom branding
- SLA
- Dedicated infrastructure

---

# 10. Recommended Primary Plan

The main sales plan should be:

```text
HIS Lite Professional
₹1,999/month
```

Highlight it as:

```text
MOST POPULAR
```

---

# 11. Optional Setup Fee

Recommended:

```text
Setup / onboarding:
₹2,500 – ₹5,000
```

Optional services:

```text
Data migration:
₹2,000+

Custom development:
₹5,000+

Additional branch:
₹500 – ₹1,000/month
```

These values should be configurable.

---

# 12. Database Design

Core entities:

```text
Clinic
SubscriptionPlan
Subscription
Payment
Invoice
WebhookEvent
SubscriptionEvent
Feature
PlanFeature
```

---

# 13. SubscriptionPlan

Suggested Prisma fields:

```text
id
code
name
description
monthly_price
currency
billing_interval
trial_days
is_active
created_at
updated_at
```

Example plan codes:

```text
STARTER
PROFESSIONAL
PREMIUM
ENTERPRISE
```

Use integer paise for monetary values where appropriate.

Example:

```text
₹1,999
stored as:
199900
```

Never use floating-point values for money.

---

# 14. Subscription

Suggested fields:

```text
id
clinic_id
plan_id

provider
provider_customer_id
provider_subscription_id

status

amount
currency
billing_interval

start_date
current_period_start
current_period_end

trial_start
trial_end

cancel_at_period_end
cancelled_at
ended_at

grace_period_start
grace_period_end

created_at
updated_at
```

---

# 15. Subscription Status

Use controlled states:

```text
TRIALING
ACTIVE
PAST_DUE
PAYMENT_FAILED
GRACE_PERIOD
CANCELLED
EXPIRED
SUSPENDED
```

Recommended lifecycle:

```text
TRIALING
   |
   v
ACTIVE
   |
   +----------------+
   |                |
   v                v
PAST_DUE        CANCELLED
   |
   v
PAYMENT_FAILED
   |
   v
GRACE_PERIOD
   |
   v
EXPIRED
```

---

# 16. Payment

Suggested fields:

```text
id
clinic_id
subscription_id

provider
provider_payment_id
provider_order_id
provider_invoice_id

amount
currency

status

payment_method
failure_reason

paid_at
created_at
updated_at
```

Payment statuses:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 17. Invoice

Suggested fields:

```text
id
clinic_id
subscription_id
invoice_number

amount
tax_amount
discount_amount
total_amount

currency

status

invoice_date
due_date
paid_at

pdf_url

created_at
updated_at
```

Invoice numbers must be unique.

Example:

```text
HIS-INV-2026-000001
HIS-INV-2026-000002
```

---

# 18. WebhookEvent

Webhook events must be stored for idempotency.

Suggested fields:

```text
id
provider
event_id
event_type
payload
signature
processed
processed_at
error_message
created_at
```

Unique constraint:

```text
provider + event_id
```

This prevents duplicate webhook processing.

---

# 19. SubscriptionEvent

Maintain a subscription audit trail.

Suggested fields:

```text
id
subscription_id
clinic_id

event_type
old_status
new_status

metadata

created_at
```

Events:

```text
SUBSCRIPTION_CREATED
SUBSCRIPTION_ACTIVATED
SUBSCRIPTION_RENEWED
SUBSCRIPTION_PAYMENT_FAILED
SUBSCRIPTION_CANCELLED
SUBSCRIPTION_EXPIRED
PLAN_UPGRADED
PLAN_DOWNGRADED
SUBSCRIPTION_REACTIVATED
```

---

# 20. Feature-Based Subscription System

Do not hard-code plan checks throughout the frontend.

Use features:

```text
PATIENT_MANAGEMENT
APPOINTMENTS
BASIC_BILLING
EMR
PRESCRIPTIONS
ADVANCED_REPORTS
INVENTORY
MULTI_DOCTOR
MULTI_BRANCH
DOCUMENT_STORAGE
```

Example:

```text
STARTER
 ├── PATIENT_MANAGEMENT
 ├── APPOINTMENTS
 └── BASIC_BILLING

PROFESSIONAL
 ├── Everything in Starter
 ├── EMR
 ├── PRESCRIPTIONS
 ├── ADVANCED_REPORTS
 └── DOCUMENT_STORAGE

PREMIUM
 ├── Everything in Professional
 ├── INVENTORY
 ├── MULTI_DOCTOR
 └── ADVANCED_ANALYTICS
```

---

# 21. Subscription Access Middleware

Every protected API route should verify:

```text
Authentication
        ↓
Clinic
        ↓
Subscription
        ↓
Feature
        ↓
Permission
```

Example:

```text
GET /api/patients
```

Checks:

```text
Authenticated?
Clinic exists?
Subscription valid?
PATIENT_MANAGEMENT enabled?
User permission valid?
```

Only then execute the operation.

---

# 22. Frontend Subscription Guard

Frontend checks are for UX only.

Example states:

```text
ACTIVE
→ allow application

GRACE_PERIOD
→ allow application + warning

EXPIRED
→ redirect to billing

SUSPENDED
→ restrict application
```

Frontend checks must never be considered security controls.

Backend enforcement is mandatory.

---

# 23. Razorpay Subscription Flow

Initial subscription:

```text
Clinic Admin
      |
      v
Select Plan
      |
      v
Backend creates Razorpay subscription
      |
      v
Frontend opens Razorpay checkout
      |
      v
Customer completes authorization/payment
      |
      v
Razorpay sends event
      |
      v
Webhook endpoint
      |
      v
Verify webhook signature
      |
      v
Update database
      |
      v
Activate subscription
```

Use the current official Razorpay documentation for exact API request/response details during implementation.

---

# 24. Payment Security

Never trust only:

```text
frontend payment success
```

The backend must verify payment/subscription status using the provider's verification mechanisms.

Webhook processing must:

1. Receive request.
2. Verify signature.
3. Check event ID.
4. Check whether event was already processed.
5. Store webhook.
6. Process event.
7. Update subscription/payment.
8. Mark webhook as processed.

---

# 25. Webhook Endpoint

Recommended:

```text
POST /api/webhooks/razorpay
```

Requirements:

- Does not require normal JWT authentication
- Requires valid Razorpay webhook signature
- Preserves raw request body where required for signature validation
- Stores webhook event
- Processes asynchronously where appropriate
- Returns quickly

---

# 26. Webhook Processing

Recommended:

```text
Razorpay
    |
    v
Webhook API
    |
    v
Verify signature
    |
    v
Store WebhookEvent
    |
    v
BullMQ
    |
    v
Subscription Worker
    |
    v
PostgreSQL
```

---

# 27. Webhook Idempotency

A webhook can be delivered more than once.

Example:

```text
Event ID:
evt_12345
```

First request:

```text
Process
Store evt_12345
```

Second request:

```text
evt_12345 already exists
```

Do not process it again.

Return a successful response.

---

# 28. Subscription Renewal

Normal renewal:

```text
Current subscription
       |
       v
Billing date
       |
       v
Razorpay charges customer
       |
       v
Payment successful
       |
       v
Webhook
       |
       v
Subscription renewed
       |
       v
current_period_end updated
```

Do not rely on a frontend request to extend a subscription.

---

# 29. Failed Payment

When payment fails:

```text
ACTIVE
  |
  v
PAYMENT_FAILED
  |
  v
PAST_DUE
  |
  v
GRACE_PERIOD
```

Send notification:

```text
Your HIS Lite subscription payment could not be completed.

Please update your payment method to avoid service interruption.
```

---

# 30. Grace Period

Recommended initial grace period:

```text
3–7 days
```

Example:

```text
Billing date:
26 September

Payment failed:
26 September

Grace period:
26–30 September

Service restriction:
After grace period
```

During grace period:

```text
Application access:
YES

Warning:
YES

Renew:
YES
```

After grace period:

```text
Application:
RESTRICTED

Patient data:
NOT DELETED

Renewal:
AVAILABLE
```

---

# 31. Expired Subscription

When a subscription expires:

```text
EXPIRED
```

Show:

```text
Your HIS Lite subscription has expired.

Renew your subscription to continue using HIS Lite.
```

Allow:

```text
Login
Subscription page
Payment
Account settings
Support
```

Restrict normal HIS operations according to the product policy.

---

# 32. Never Delete Clinic Data on Expiry

Critical rule:

```text
Subscription expiry != data deletion
```

Patient records, appointments, invoices, documents and audit logs must remain preserved according to the retention policy.

---

# 33. Cancellation

Support:

```text
Cancel immediately
```

and:

```text
Cancel at end of billing period
```

Recommended SaaS behavior:

```text
Cancel at period end
```

Example:

```text
Current period:
26 Aug → 26 Sep

Customer cancels:
10 Sep

Access remains active:
until 26 Sep

Renewal:
disabled
```

---

# 34. Plan Upgrade

Example:

```text
Starter
₹999
   |
   v
Professional
₹1,999
```

Define a clear proration policy and use the payment provider's supported subscription update mechanism.

Recommended initial behavior:

```text
Upgrade:
Immediate

Downgrade:
Apply at next billing cycle
```

---

# 35. Subscription API

Recommended endpoints:

## Plans

```text
GET /api/subscription/plans
```

## Current subscription

```text
GET /api/subscription
```

## Create subscription

```text
POST /api/subscription/create
```

## Change plan

```text
POST /api/subscription/change-plan
```

## Cancel subscription

```text
POST /api/subscription/cancel
```

## Reactivate

```text
POST /api/subscription/reactivate
```

## Renew

```text
POST /api/subscription/renew
```

## Payments

```text
GET /api/subscription/payments
```

## Invoices

```text
GET /api/subscription/invoices
```

## Invoice

```text
GET /api/subscription/invoices/:id
```

## Webhook

```text
POST /api/webhooks/razorpay
```

---

# 36. Admin Subscription APIs

Super admin endpoints:

```text
GET /api/admin/subscriptions
GET /api/admin/subscriptions/:id
GET /api/admin/payments
GET /api/admin/invoices
GET /api/admin/webhooks
POST /api/admin/subscriptions/:id/suspend
POST /api/admin/subscriptions/:id/reactivate
POST /api/admin/subscriptions/:id/extend
```

All admin actions must be audited.

---

# 37. Admin Dashboard

Show:

```text
Total Clinics
Active Subscriptions
Trial Clinics
Past Due
Payment Failed
Grace Period
Expired
Cancelled
Monthly Recurring Revenue
Monthly Payments
Failed Payments
```

Example:

```text
ACTIVE CLINICS          47
MRR                     ₹93,953
PAYMENT FAILED           3
GRACE PERIOD             2
EXPIRED                  5
```

---

# 38. Clinic Billing Page

The clinic admin should see:

```text
Current Plan
Professional

Price
₹1,999/month

Status
Active

Next Billing Date
26 September 2026

Renewal
Automatic

Payment Method
Configured

[Manage Subscription]
[View Payments]
[View Invoices]
[Upgrade Plan]
[Cancel Subscription]
```

---

# 39. Subscription Notifications

Send notifications for:

```text
Subscription created
Payment successful
Payment failed
3 days before expiry
1 day before expiry
Subscription expired
Subscription renewed
Subscription cancelled
Plan upgraded
Plan downgraded
```

Email + in-app notification can be supported.

---

# 40. Production Email

Do NOT use Mailpit in production.

Mailpit is for development/testing only.

Production should use a real SMTP/email provider.

Environment variables:

```env
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
```

---

# 41. Production Docker Services

Recommended:

```text
nginx
api
web
postgres
redis
minio
worker
```

Optional:

```text
backup
monitoring
```

Do NOT run in normal production:

```text
mailpit
prisma-studio
```

---

# 42. Production PostgreSQL

PostgreSQL must NOT publish:

```text
5432:5432
```

Allow only internal Docker networking.

The API should connect using:

```text
postgres:5432
```

not:

```text
localhost:5432
```

---

# 43. Production Redis

Redis must NOT be publicly exposed.

Remove:

```text
6379:6379
```

The API/worker should use:

```text
redis:6379
```

Set a strong Redis password if authentication is enabled.

---

# 44. Production MinIO

MinIO should not expose administrative ports publicly unless required.

Prefer:

```text
API
  |
  v
MinIO
```

rather than exposing MinIO directly to the Internet.

If external document access is required, use signed URLs.

---

# 45. Signed File URLs

Patient documents should not use permanent public URLs.

Use:

```text
Private MinIO bucket
        |
        v
Backend authorization
        |
        v
Signed temporary URL
```

Example:

```text
URL valid for 5 minutes
```

This is important for healthcare documents.

---

# 46. Healthcare Data Security

HIS Lite handles potentially sensitive healthcare information.

Security requirements:

```text
HTTPS
Strong authentication
Strong password hashing
JWT security
Role-based access control
Tenant isolation
Audit logging
Database backups
Encrypted secrets
Private object storage
Secure file access
Rate limiting
Input validation
SQL injection protection
XSS protection
CSRF protection where applicable
```

---

# 47. Password Security

Use bcrypt or another strong password hashing algorithm.

Never store plain text passwords.

Recommended:

```env
BCRYPT_ROUNDS=12
```

Adjust after production performance testing.

---

# 48. JWT

Current development configuration contains:

```env
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Production must use cryptographically random secrets.

Never use development secrets in production.

Never commit secrets to Git.

---

# 49. Production Environment Variables

Example:

```env
NODE_ENV=production

POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

DATABASE_URL=

REDIS_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=12

S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=

MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=

FRONTEND_URL=
API_URL=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Never commit `.env`.

---

# 50. Production Docker Compose

Production should:

- Build production images
- Run compiled backend
- Run production frontend
- Remove source-code volume mounts
- Remove Mailpit
- Remove Prisma Studio
- Remove public database ports
- Remove public Redis ports
- Remove default passwords
- Use production environment variables
- Use health checks
- Use restart policies

Example structure:

```yaml
services:

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  minio:
    image: minio/minio
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: production
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: production
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    restart: unless-stopped
```

---

# 51. Database Migration

Development:

```bash
npx prisma migrate dev
```

Production:

```bash
npx prisma migrate deploy
```

Never use:

```bash
prisma migrate reset
```

on production.

---

# 52. Database Backup

PostgreSQL must be backed up automatically.

Recommended:

```text
Daily full database backup
```

Example:

```text
02:00 AM
   |
   v
pg_dump
   |
   v
Compressed backup
   |
   v
External backup storage
```

Do not keep the only backup on the same VPS.

---

# 53. Backup Retention

Example:

```text
Daily:
7 days

Weekly:
4 weeks

Monthly:
3 months
```

Adjust based on business requirements.

---

# 54. Backup Testing

A backup is not reliable until restoration has been tested.

At least monthly:

```text
Backup
  ↓
Restore to test database
  ↓
Verify tables
  ↓
Verify records
  ↓
Verify application connection
```

---

# 55. MinIO Backup

Patient documents stored in MinIO must also be backed up.

Database backup alone is not enough.

Back up:

```text
PostgreSQL
+
MinIO
```

---

# 56. Health Checks

API:

```text
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

Optional:

```text
GET /health/ready
```

Check:

```text
PostgreSQL
Redis
MinIO
```

---

# 57. Monitoring

Monitor:

```text
CPU
RAM
Disk
Database size
Docker containers
API errors
HTTP response time
Redis memory
MinIO storage
Backup status
Subscription webhook failures
Payment failures
```

Set alerts for:

```text
Disk > 80%
RAM > 85%
CPU sustained > 80%
Backup failed
Database unavailable
API unavailable
SSL expiry
```

---

# 58. VPS Firewall

Allow only required ports.

Typical:

```text
22    SSH
80    HTTP
443   HTTPS
```

Do NOT publicly expose:

```text
5432 PostgreSQL
6379 Redis
9000 MinIO
9001 MinIO Console
5555 Prisma Studio
```

---

# 59. Nginx

Nginx should handle:

```text
HTTPS
HTTP → HTTPS redirect
Frontend routing
API reverse proxy
Security headers
Request size limits
Compression
```

Frontend:

```text
app.hislite.in
       |
       v
Nginx
       |
       v
web:3000
```

API:

```text
api.hislite.in
       |
       v
Nginx
       |
       v
api:4000
```

---

# 60. SSL

Use Let's Encrypt.

All production traffic must use:

```text
HTTPS
```

Never send patient data over HTTP.

---

# 61. API Rate Limiting

Current development values:

```env
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

Review production limits based on actual API behavior.

Use stricter limits for:

```text
Login
Password reset
OTP
Public endpoints
Sensitive operations
```

Webhook authentication must rely on provider signature verification rather than normal user rate limits alone.

---

# 62. Authentication

Recommended:

```text
Login
  |
  v
Validate credentials
  |
  v
Generate access token
  |
  v
Generate refresh token
  |
  v
Authenticated session
```

Suggested initial durations:

```text
Access token:
15 minutes

Refresh token:
7 days
```

---

# 63. Roles

Initial roles:

```text
SUPER_ADMIN
CLINIC_ADMIN
DOCTOR
RECEPTIONIST
STAFF
```

Example permissions:

```text
CLINIC_ADMIN
  ├── subscription
  ├── users
  ├── doctors
  ├── patients
  ├── reports
  └── billing

DOCTOR
  ├── patients
  ├── appointments
  ├── EMR
  └── prescriptions

RECEPTIONIST
  ├── patients
  ├── appointments
  └── billing
```

---

# 64. Subscription Permission

Only appropriate clinic users should manage subscriptions.

Recommended:

```text
CLINIC_ADMIN
```

can:

```text
View subscription
View invoices
View payments
Upgrade
Downgrade
Cancel
Renew
```

Doctors and receptionists should not manage billing unless explicitly permitted.

---

# 65. Audit Logs

Track sensitive actions:

```text
Login
Logout
Patient creation
Patient update
Patient deletion
Prescription creation
Invoice creation
Payment
Subscription change
Plan change
User creation
Permission change
Document access
Document deletion
```

Subscription events must be auditable.

---

# 66. Subscription Cron / Scheduled Jobs

Use BullMQ repeatable jobs or another reliable scheduler.

Jobs:

```text
subscription-expiry-check
payment-reminder
subscription-reconciliation
invoice-generation
email-notification
backup
```

Example:

```text
Every hour:
Check subscriptions
```

```text
Every day:
Send expiry reminders
```

---

# 67. Subscription Reconciliation

Do not rely only on webhooks.

Run periodic reconciliation.

Example:

```text
Every 6 hours
       |
       v
Find active subscriptions
       |
       v
Check provider status
       |
       v
Compare with local DB
       |
       v
Correct mismatches
```

This protects against:

- Missed webhook
- Temporary network failure
- Application downtime
- Provider event delay

---

# 68. Webhook Failure Recovery

```text
Webhook received
       |
       v
Stored
       |
       v
Processing failed
       |
       v
Retry queue
       |
       v
Process again
```

Use exponential retry where appropriate.

---

# 69. Clinic Onboarding

Recommended:

```text
Visit HIS Lite
       |
       v
Create Account
       |
       v
Clinic Details
       |
       v
Create Admin
       |
       v
Select Plan
       |
       v
Payment
       |
       v
Subscription Active
       |
       v
Clinic Dashboard
```

---

# 70. Optional Trial

Possible:

```text
7-day free trial
```

or:

```text
14-day free trial
```

If offered:

```text
TRIALING
```

must be stored as a real subscription status.

Define:

- Whether payment method is required
- Whether trial auto-converts
- Trial expiry
- Feature restrictions
- User limits
- Patient limits
- Whether trial can be reused

---

# 71. Recommended Initial Commercial Model

Start simple:

```text
Professional:
₹1,999/month

Optional setup:
₹2,500–₹5,000

Optional trial:
7 days
```

Avoid complicated billing rules in the first release.

---

# 72. Customer Subscription Journey

```text
LANDING PAGE
     |
     v
PRICING
     |
     v
SELECT PLAN
     |
     v
REGISTER CLINIC
     |
     v
PAYMENT
     |
     v
ACTIVATION
     |
     v
HIS DASHBOARD
     |
     v
MONTHLY RENEWAL
     |
     +---- SUCCESS → Continue
     |
     +---- FAILED → Grace Period
                         |
                         +---- PAYMENT → Continue
                         |
                         +---- NO PAYMENT → Expired
```

---

# 73. Billing Page UX

The billing page should include:

```text
Current Plan
Plan Price
Subscription Status
Current Billing Period
Next Billing Date
Payment Method
Payment History
Invoices
Upgrade
Downgrade
Cancel
Renew
```

Use status badges:

```text
ACTIVE
PAST DUE
GRACE PERIOD
EXPIRED
CANCELLED
```

---

# 74. Subscription Status Banner

Active:

```text
Your Professional plan is active.
Next billing date: 26 September 2026.
```

Grace period:

```text
Your subscription payment failed.
Please update your payment method to avoid service interruption.
```

Expired:

```text
Your subscription has expired.
Renew now to continue using HIS Lite.
```

---

# 75. Security Rules

Never allow the frontend to:

```text
change subscription status
change expiry date
change payment status
activate subscription
extend subscription
```

Only trusted backend logic can change:

```text
ACTIVE
EXPIRED
PAST_DUE
CANCELLED
```

---

# 76. Database Transactions

Payment/subscription updates should use database transactions where multiple records must change together.

Example:

```text
Payment
+
Subscription
+
SubscriptionEvent
```

should be updated atomically where appropriate.

---

# 77. Concurrency Protection

Protect against simultaneous webhook requests using:

```text
Unique webhook event ID
Database transactions
Row-level locking where appropriate
Idempotency
```

---

# 78. API Error Handling

Use consistent responses.

Example:

```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_EXPIRED",
    "message": "Your subscription has expired. Please renew your plan."
  }
}
```

---

# 79. Subscription Error Codes

Recommended:

```text
SUBSCRIPTION_REQUIRED
SUBSCRIPTION_EXPIRED
SUBSCRIPTION_PAST_DUE
SUBSCRIPTION_CANCELLED
FEATURE_NOT_AVAILABLE
PAYMENT_FAILED
PAYMENT_REQUIRED
PLAN_NOT_FOUND
INVALID_SUBSCRIPTION
```

---

# 80. Medical Data Rule

Subscription restrictions must never corrupt or delete healthcare records.

When a subscription expires:

```text
Patient data remains intact.
Appointments remain intact.
Invoices remain intact.
Documents remain intact.
Audit logs remain intact.
```

---

# 81. Docker Network

Use:

```text
hislite-network
```

Services communicate using Docker service names:

```text
postgres
redis
minio
api
worker
web
```

Do not use `localhost` between containers.

---

# 82. Development URLs

Current development configuration:

```text
Frontend:
http://localhost:3000

API:
http://localhost:4000

PostgreSQL:
localhost:5432

Redis:
localhost:6379

MinIO:
localhost:9000

MinIO Console:
localhost:9001

Mailpit:
localhost:8025

Prisma Studio:
localhost:5555
```

These are development-only.

---

# 83. Production URLs

Recommended:

```text
https://app.hislite.in
https://api.hislite.in
```

Optional:

```text
https://admin.hislite.in
```

Do not expose internal services publicly.

---

# 84. Production Deployment Flow

```text
Developer
   |
   v
Git repository
   |
   v
VPS
   |
   v
Docker build
   |
   v
Database migration
   |
   v
Docker Compose
   |
   v
Health checks
   |
   v
Nginx
   |
   v
HTTPS
```

---

# 85. Deployment Commands

On VPS:

```bash
git pull
```

Build:

```bash
docker compose -f docker-compose.prod.yml build
```

Run migrations:

```bash
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

Start:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Check:

```bash
docker compose -f docker-compose.prod.yml ps
```

Logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

---

# 86. Git Rules

Never commit:

```text
.env
production secrets
JWT secrets
Razorpay secret
database passwords
MinIO credentials
private keys
backup files
```

Commit only:

```text
.env.example
```

---

# 87. Logging

Application logs should contain:

```text
timestamp
request ID
user ID
clinic ID
endpoint
status
response time
error code
```

Do NOT log:

```text
password
JWT token
payment secret
database password
full medical record
private document contents
```

---

# 88. Payment Logging

Safe logging:

```text
Clinic ID
Subscription ID
Payment ID
Amount
Status
Timestamp
```

Never log:

```text
Card number
CVV
UPI credentials
Payment secrets
Authentication secrets
```

---

# 89. Database Indexes

Important indexes:

```text
clinic_id
clinic_id + created_at
clinic_id + status
subscription_id
provider_subscription_id
provider_payment_id
provider_event_id
```

Review indexes on every major tenant-scoped table.

---

# 90. Unique Constraints

Important unique constraints:

```text
Provider subscription ID
Provider payment ID
Invoice number
Provider + webhook event ID
Plan code
```

---

# 91. Subscription State Machine

Implement controlled state transitions.

Valid examples:

```text
TRIALING → ACTIVE

ACTIVE → PAST_DUE

PAST_DUE → ACTIVE

PAST_DUE → GRACE_PERIOD

GRACE_PERIOD → ACTIVE

GRACE_PERIOD → EXPIRED

ACTIVE → CANCELLED

CANCELLED → ACTIVE
```

Do not allow arbitrary state changes.

---

# 92. Admin Manual Extension

SUPER_ADMIN may extend a subscription for:

- Promotional period
- Support compensation
- Offline payment
- Migration
- Special agreement

Example:

```text
Extend by:
7 days
30 days
90 days
```

Every manual extension must create a `SubscriptionEvent` containing:

```text
admin_user_id
reason
old_expiry
new_expiry
```

---

# 93. Offline Payment

If supported:

```text
Admin records payment
       |
       v
Payment status = CAPTURED
       |
       v
Subscription activated/extended
```

Only `SUPER_ADMIN` should perform this action.

Clinic users must not be able to mark their own payment successful.

---

# 94. Tax / GST

Billing architecture should support:

```text
subtotal
discount
tax
total
```

Do not hard-code tax logic into payment processing.

Store tax values on invoices.

GST handling should be configured according to the actual business/tax setup before production billing.

---

# 95. Data Retention

Define retention policies for:

```text
Patient data
Documents
Audit logs
Payment records
Invoices
Webhook events
Application logs
Backups
```

Subscription expiry must not automatically delete clinical records.

---

# 96. Disaster Recovery

If the VPS fails:

```text
New VPS
   |
   v
Install Docker
   |
   v
Restore PostgreSQL
   |
   v
Restore MinIO
   |
   v
Deploy application
   |
   v
Configure DNS
   |
   v
SSL
   |
   v
HIS Lite restored
```

Maintain documented recovery procedures.

---

# 97. Recovery Targets

Define:

```text
RPO
Recovery Point Objective

RTO
Recovery Time Objective
```

Initial targets can be:

```text
RPO: 24 hours or better
RTO: 4–8 hours
```

Improve these as the SaaS grows.

---

# 98. Production Checklist

- [ ] Production VPS configured
- [ ] Docker installed
- [ ] Firewall configured
- [ ] SSH secured
- [ ] Domain configured
- [ ] DNS configured
- [ ] HTTPS configured
- [ ] PostgreSQL private
- [ ] Redis private
- [ ] MinIO private
- [ ] Production environment variables configured
- [ ] Strong JWT secrets configured
- [ ] Database migration tested
- [ ] Database backup configured
- [ ] MinIO backup configured
- [ ] Backup restore tested
- [ ] Razorpay production credentials configured
- [ ] Razorpay webhook configured
- [ ] Webhook signature verification tested
- [ ] Payment success tested
- [ ] Payment failure tested
- [ ] Renewal tested
- [ ] Cancellation tested
- [ ] Grace period tested
- [ ] Expiry tested
- [ ] Reactivation tested
- [ ] Plan upgrade tested
- [ ] Plan downgrade tested
- [ ] Multi-tenant isolation tested
- [ ] RBAC tested
- [ ] Rate limiting tested
- [ ] Audit logging tested
- [ ] Error handling tested
- [ ] Monitoring configured

---

# 99. Subscription Testing Matrix

Test:

```text
New subscription
Successful payment
Failed payment
Duplicate webhook
Delayed webhook
Missing webhook
Renewal
Cancellation
Cancellation at period end
Immediate cancellation
Upgrade
Downgrade
Expired subscription
Grace period
Reactivation
Manual admin extension
Refund
Payment reconciliation
```

---

# 100. Security Testing

Test:

```text
Clinic A cannot access Clinic B data.

Doctor cannot manage subscription.

Receptionist cannot access admin functions.

Expired clinic cannot access protected HIS APIs.

Frontend cannot bypass subscription restrictions.

Webhook cannot be forged.

Duplicate webhook cannot duplicate payment.

User cannot change clinic_id through request payload.

User cannot access another clinic's document URL.

SQL injection blocked.

XSS blocked.

Rate limiting works.

JWT expiration works.

Refresh token security works.
```

---

# 101. Recommended Implementation Order

## Phase 1 — Database

Create:

```text
SubscriptionPlan
Subscription
Payment
Invoice
WebhookEvent
SubscriptionEvent
Feature
PlanFeature
```

Run Prisma migration.

---

## Phase 2 — Plans

Create:

```text
Starter
Professional
Premium
```

Seed initial data.

---

## Phase 3 — Subscription Service

Implement:

```text
SubscriptionService
```

Responsibilities:

```text
createSubscription()
getSubscription()
activateSubscription()
renewSubscription()
cancelSubscription()
expireSubscription()
changePlan()
checkAccess()
```

---

## Phase 4 — Payment Integration

Implement:

```text
RazorpayService
```

Responsibilities:

```text
createCustomer()
createSubscription()
fetchSubscription()
cancelSubscription()
pauseSubscription()
resumeSubscription()
verifyPayment()
verifyWebhook()
```

Use the current official Razorpay API documentation for provider-specific implementation details.

---

## Phase 5 — Webhooks

Implement:

```text
POST /api/webhooks/razorpay
```

Add:

```text
signature verification
idempotency
database transaction
BullMQ processing
retry
logging
```

---

## Phase 6 — Access Control

Add:

```text
SubscriptionGuard
FeatureGuard
```

Backend enforcement first.

Frontend guard second.

---

## Phase 7 — Billing UI

Create:

```text
/pricing
/subscription
/billing
/payments
/invoices
```

---

## Phase 8 — Admin

Create:

```text
Admin subscription dashboard
Payment dashboard
Clinic subscription management
Webhook monitoring
```

---

## Phase 9 — Notifications

Implement:

```text
payment success
payment failed
expiry reminder
subscription expired
renewal
cancellation
```

---

## Phase 10 — VPS Production

Configure:

```text
Docker
PostgreSQL
Redis
MinIO
API
Worker
Web
Nginx
SSL
Firewall
Backups
Monitoring
```

---

# 102. Cursor Implementation Rules

When implementing this architecture in Cursor:

1. Inspect the existing project before changing files.
2. Do not rewrite the existing HIS Lite architecture unnecessarily.
3. Reuse the existing Prisma schema where possible.
4. Do not create duplicate authentication systems.
5. Do not create a second database connection system.
6. Follow existing coding conventions.
7. Create Prisma migrations instead of manually modifying production databases.
8. Keep payment provider logic isolated in a service.
9. Keep subscription business logic isolated in a service.
10. Keep webhook processing idempotent.
11. Never trust frontend subscription status.
12. Never expose database credentials.
13. Never expose Razorpay secret keys to React.
14. Never expose MinIO root credentials to React.
15. Never delete clinical data when subscription expires.
16. Add automated tests for subscription state transitions.
17. Add tenant-isolation tests.
18. Do not break existing HIS Lite modules.
19. Do not modify unrelated modules.
20. Document every new environment variable.

---

# 103. Final Target Architecture

```text
                         INTERNET
                            |
                         HTTPS
                            |
                         NGINX
                            |
              +-------------+-------------+
              |                           |
        React Web App                Node.js API
                                          |
                         +----------------+----------------+
                         |                |                |
                    PostgreSQL         Redis             MinIO
                    + Prisma          + BullMQ          Documents
                                          |
                                      Worker
                                          |
                           +--------------+--------------+
                           |                             |
                     Webhooks                       Scheduled Jobs
                           |
                       Razorpay
```

---

# 104. Core Principle

The most important rule:

```text
PAYMENT PROVIDER
       ↓
Subscription Billing
       ↓
Webhook
       ↓
Backend
       ↓
PostgreSQL
       ↓
Subscription Status
       ↓
API Authorization
       ↓
HIS Lite Access
```

Never:

```text
Frontend
   ↓
"Payment Successful"
   ↓
Give access
```

The backend must always be the authority for application access.

---

# 105. MVP Implementation Target

For the first production release, implement:

```text
1. Clinic
2. Users
3. Plans
4. Subscription
5. Payment
6. Razorpay recurring subscription
7. Webhook
8. Subscription middleware
9. Billing page
10. Payment history
11. Invoice records
12. Grace period
13. Expiry
14. Renewal
15. Admin subscription management
16. Email notifications
17. PostgreSQL backup
18. VPS deployment
19. HTTPS
20. Security controls
```

Do not over-engineer the first release.

---

# 106. Recommended Initial SaaS Offer

```text
HIS Lite Professional

₹1,999 / month

✓ Patient Management
✓ Appointment Management
✓ Doctor Management
✓ EMR
✓ Prescription
✓ Billing
✓ Reports
✓ Document Management
✓ Cloud Hosting
✓ Automated Backup
✓ Software Updates
✓ Secure HTTPS
✓ Email Notifications
✓ Support

Monthly recurring subscription
No long-term contract
Cancel according to subscription terms
```

---

# 107. Definition of Done

The subscription system is production-ready when:

```text
A clinic can register
        ↓
Choose a plan
        ↓
Complete payment
        ↓
Subscription becomes active
        ↓
Use HIS Lite
        ↓
Payment renews automatically
        ↓
Webhook updates subscription
        ↓
Payment failure triggers notification
        ↓
Grace period starts
        ↓
Subscription expires if unpaid
        ↓
HIS access becomes restricted
        ↓
Clinic renews
        ↓
Access is restored
```

And:

```text
Clinic A cannot access Clinic B data.
```

This is a mandatory acceptance criterion.

---

# 108. Final Technology Stack

```text
Frontend:
React + Vite

Backend:
Node.js API

ORM:
Prisma

Database:
PostgreSQL 16

Cache:
Redis 7

Queue:
BullMQ

Object Storage:
MinIO / S3-compatible

Payment:
Razorpay Subscriptions

Web Server:
Nginx

SSL:
Let's Encrypt

Containers:
Docker + Docker Compose

Hosting:
VPS

Authentication:
JWT + Refresh Token

Password:
bcrypt

Architecture:
Multi-tenant SaaS
```

---

# 109. Implementation Priority

```text
P0 — Mandatory
├── Multi-tenancy
├── Subscription database
├── Payment integration
├── Webhook
├── Subscription access middleware
├── Security
└── Backup

P1 — Required for launch
├── Billing UI
├── Payment history
├── Invoice
├── Notifications
├── Admin dashboard
└── VPS deployment

P2 — After launch
├── Advanced analytics
├── Automated reconciliation improvements
├── WhatsApp notifications
├── Coupons
├── Referral system
├── Annual plans
├── Multiple branches
└── Enterprise billing
```

---

# 110. Annual Plans — Later

After monthly billing is stable, add:

```text
Monthly
₹1,999/month

Annual
₹19,990/year
```

This provides approximately two months free compared with monthly billing.

Implement annual billing only after monthly subscription lifecycle is stable.

---

# 111. Current Docker Compose Assessment

The supplied Compose file already provides:

```text
PostgreSQL
Redis
MinIO
Mailpit
API
React Web
Prisma Studio
```

This is a good development stack.

The subscription system should primarily integrate with:

```text
apps/api
apps/web
packages/
prisma/
```

The production deployment should use:

```text
docker-compose.prod.yml
```

Do not replace the development Compose file with the production configuration.

---

# 112. Final Architecture Decision

The official HIS Lite SaaS architecture is:

```text
HIS Lite
│
├── React + Vite
├── Node.js API
├── PostgreSQL + Prisma
├── Redis + BullMQ
├── MinIO
├── Razorpay Subscriptions
├── Nginx
├── Docker
└── VPS
```

with:

```text
Multi-Tenant SaaS
+
Monthly Subscription
+
Recurring Payment
+
Webhook Verification
+
Subscription Middleware
+
Feature-Based Access
+
Automated Notifications
+
Automated Backups
+
Production Security
```

This document is the technical specification for implementing HIS Lite subscription billing and VPS production deployment. It complements, and does not replace, the existing HIS Lite functional requirements.
