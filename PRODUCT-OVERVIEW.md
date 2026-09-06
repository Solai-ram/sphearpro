# MediOne — Product Overview

**MediOne** (HIS Lite) is an AI-assisted **multi-tenant clinic management** system. Each clinic is an isolated tenant with its own patients, staff, and clinical records. Commercial access is gated by a SaaS subscription (`STANDARD` @ ₹1,500/month) billed through Razorpay.

This document describes **the product as it exists in this repository today**. Architecture and decisions: `HIS-Lite-Architecture-and-User-Stories.md`, `docs/SAAS-DECISIONS.md`. Demo accounts: `LOGIN.md`. Launch ops: `docs/SAAS-LAUNCH-CHECKLIST.md`.

> **Stale assumption (pre-SaaS):** older notes that described “a single clinic only” are obsolete. The app is multi-tenant; the **default seeded clinic** is still the usual local demo tenant.

---

## 1. What the product is

MediOne is built for clinics that run both **consultations** and **recurring therapy**, and also sell **devices/products** and **lab/diagnostic tests**. Typical users are receptionists, doctors, therapists, billing staff, inventory staff, and a clinic administrator. A separate **platform super-admin** manages subscriptions across clinics (`/platform`).

It is **not** a full hospital HIS. There is no inpatient ward, no patient portal, no mobile app, no insurance claims engine, and no FHIR/HL7 integration in this version.

**Product name in the UI:** MediOne  
**Currency:** INR (₹)  
**Primary language of the UI:** English, with Indian date/number formatting  
**SaaS plan (MVP):** single plan `STANDARD` — ₹1,500 / month; 5-day grace; cancel at period end; clinical data retained on expiry

Public marketing/onboarding routes: `/pricing`, `/signup`. Clinic billing: `/subscription`.

---

## 2. Architecture in one paragraph

MediOne is a **modular monolith**, not a set of independently deployed microservices.

There is **one React web app** (`apps/web`) and **one NestJS API** (`apps/api`). Domain work is split into NestJS **modules** (patients, clinical, therapy, billing, lab, inventory, and so on). Those modules share one PostgreSQL database, one Redis instance, and one authentication/RBAC layer. Background jobs (WhatsApp, AI, PDFs) run through BullMQ workers in the same API process.

That is what “many services” means here: **many business modules behind one application**, designed so a module could be extracted later if scale requires it.

```
Browser (React + Vite)
        │  REST  /api/v1/...
        ▼
NestJS API  (auth, patients, clinical, therapy,
             lab, billing, inventory, documents, communication,
             AI, reports, dashboard, users, roles, settings)
        │
        ├── PostgreSQL  (source of truth)
        ├── Redis + BullMQ  (queues, cache, locks)
        └── Object storage (S3 / MinIO)  (PDFs, documents, audio)
```

Local supporting containers (from Docker Compose): PostgreSQL, Redis, MinIO, Mailpit.  
Production VPS: separate `docker-compose.prod.yml` — see `docs/DEPLOY-PRODUCTION.md`.

---

## 3. Technology stack (as built)

| Layer | Choice |
|---|---|
| Web app | React, TypeScript, Vite, Tailwind CSS, React Router |
| Forms / tables | React Hook Form, Zod, TanStack Table |
| API | NestJS, TypeScript, REST under `/api/v1`, OpenAPI/Swagger |
| Database | PostgreSQL + Prisma |
| Jobs / cache | Redis, BullMQ |
| Auth | JWT access + refresh tokens; database-driven RBAC |
| Files | S3-compatible storage (MinIO in development) |
| Invoices / receipts | Print-ready HTML and PDF generation |
| AI | NestJS AI gateway → Gemini (summaries / SOAP drafts) and ElevenLabs (speech-to-text) |
| Messaging | WhatsApp Business API (queued; delivery status stored) |
| Themes | Clinic-configurable UI themes (Clinical Blue, Midnight, Emerald Care, Sunset Coral) |

Run locally: web on **http://localhost:3000**, API on **http://localhost:4000/api/v1**.

---

## 4. Who uses it

Access is **role-based**. The job the user is working as (staff type) decides the sidebar. Admin sees everything.

| Role | Typical work |
|---|---|
| **Receptionist** | Register OP patients, run the waiting queue, search patients |
| **Doctor** | Therapy appointments / sessions, AI drafts |
| **Therapist** | Therapy cases, packages, sessions, attendance, notes, AI summaries |
| **Billing** | Invoices, payments, billing and revenue reports |
| **Inventory** | Item master, stock, suppliers, stock/sales reports |
| **Admin** | Users, roles, permissions, audit, settings, dashboards, all modules, **clinic SaaS subscription** |
| **Platform SUPER_ADMIN** | Cross-clinic subscription console only (`/platform`) — not day-to-day clinic HIS |

There is **no patient login**. Patients do not use the system directly.

Clinic **ADMIN** manages SaaS billing under `/subscription`. Other clinical roles cannot open subscription checkout.

Roles and permissions are **stored in the database**. Admin can create custom roles and attach fine-grained permissions. The sidebar is a starting filter; **authorization is enforced on the API**.

---

## 5. Domain model (the part that is easy to get wrong)

**Patient** is the centre of the product. Every clinical and financial event hangs off the patient and appears on a **timeline** (OP visits, therapy, invoices, documents, and so on).

Important separations:

| These are not the same | Why it matters |
|---|---|
| **OP has no doctor appointment** | OP is walk-in / registration → clinical case. No booking slot for OP |
| **Therapy session = clinic visit with a doctor** | Each therapy session is scheduled and assigned its own doctor |
| **Doctors differ per session** | Session 1 may be Dr A, session 2 Dr B, session 3 Dr C — same patient, different doctors over the programme |
| **Invoice ≠ payment** | Billing creates a debt; collection is a separate payment |
| **Attendance ≠ billing** | A session can be attended without a separate fee if a package covers it |

**Therapy hierarchy**

Patient → Therapy case → Therapy package → Patient package (total / used / remaining sessions + expiry) → Therapy sessions → Attendance, notes, billing

**Central billing engine**

OP consultation fees, therapy packages, lab tests, and products all become **billable items** on one invoice chain:

`Billable item → Invoice → Payment → Receipt`

Billable types in use:

- `OP_VISIT` — consultation fee (from OP registration)
- `THERAPY_PACKAGE` / `THERAPY_SESSION`
- `LAB_TEST`
- `PRODUCT`
- `OTHER`

---

## 6. Product modules

### 6.1 Dashboard

Role-specific home screen.

- KPI cards (patients, OP, therapy, revenue, outstanding, low stock, WhatsApp failures, AI usage)
- Daily / weekly / monthly / custom date range
- Therapy schedule for the selected range
- Quick actions (register patient, queue, new OP, invoice, inventory)
- Admin can **customise** widget layout (`/dashboard-builder`)

### 6.2 Patients and OP registration

The front-desk OP path is the main way new clinic visitors enter the system.

**New OP registration** (`/patients/new?intent=op`)

1. Capture patient demographics (name, age, gender, phone, address).
2. Continue to the OP visit screen.
3. Enter **consultation fees** and **mode of payment** (Cash / UPI / Card). There is **no doctor dropdown** at registration.
4. Saving creates the OP case, an `OP_VISIT` invoice, and a successful payment so the fee appears in **revenue**.
5. Optional **print receipt** (letterhead from clinic settings).

**OP review registration** is the same fee/payment flow for a **returning** OP patient (must already have a previous OP case).

Other patient screens:

- **OP reports** — patient list / OP register
- **Patient search** — lookup by name, phone, or number
- **Patients modify** — edit existing records
- **Patient chart** — demographics, timeline, documents, linked OP and therapy

Patients can be soft-deleted. Each patient has a unique **patient number**.

### 6.3 Appointments (therapy only)

Clinic schedule for **therapy sessions** — not OP consultations.

- **Assign Doctors** — pick an upcoming therapy patient, add one or more time slots **(including several on the same day)**, assign a **different doctor per slot** (shows that doctor’s free slots)
- **Calendar** — month counts; click a day to see patients and doctors
- **Day schedule** — time on the left, doctors across the top; drag appointments between doctors when the slot is free
- **Slot timings** — create/edit clinic slot templates and each doctor’s weekly availability hours

OP patients are never booked here. Use **Patients → OP registration** for consultations.

### 6.4 Reception

Waiting-queue operations for the front desk: check-in and queue status so doctors and reception see who is waiting.

### 6.5 Clinical (OP cases)

Removed from the product sidebar. OP visits are created only through **Patients → New / review OP registration**. Doctors work therapy visits from **Appointments**, not a separate clinical chart module.

Legacy `/clinical` URLs redirect to Patients. The API still stores OP cases for registration, receipts, and the OP clinical report.

### 6.6 Therapy

For patients who already have OP history (therapy registration searches OP-registered patients).

**How therapy visits work (not OP appointments):**

1. Patient is on a therapy programme (case + package).
2. The package generates a series of **sessions** (the only “appointments” in MediOne).
3. When the patient comes to the clinic for a session, that session is with **one doctor**.
4. The **next** session can be with a **different** doctor, and so on — doctor is chosen **per session**, not once for the whole case.

- **Therapy types** and **packages** (session count, frequency, price, validity)
- Frequencies: weekly, twice weekly, three times weekly, daily, every two weeks, monthly, custom
- Register a therapy case: patient, optional OP case, therapist (programme owner), package, title, assessment, goals
- Purchasing a package creates a **patient package** and can generate the session series
- **Upcoming sessions** — assign **which doctor** sees the patient for that session; mark attendance; write notes
- Attendance: Present, Absent, Cancelled, Rescheduled, Late
- Therapist notes in a SOAP-like structure: Subjective, Objective, Activities, Observations, Progress, Challenges, Next plan
- Package utilisation (used vs remaining sessions, expiry)

### 6.7 Lab

Catalogue of billed diagnostic / audiology procedures, not a full LIS.

- Dashboard: tests billed today / last 7 days / this month, revenue, top procedures, recent billed lines
- **Lab procedure creation**: code, name, department, sample type, price, TAT hours, instructions
- Lab tests are billed through the **central invoice engine** as `LAB_TEST` (from New billing)

### 6.8 Billing

One billing module for the clinic.

**New billing** wizard:

1. Choose category: **Product**, **Lab**, or **Therapy**
2. Search patient
3. Add catalogue lines (stock items, lab procedures, or therapy packages)
4. Collect **Cash / UPI / Card** (optional reference)
5. Create invoice **and** payment together

Also:

- Invoice list, invoice detail, cancel
- Print / save PDF (clinic letterhead, GSTIN, terms from settings)
- Record extra payments and refunds
- **Billing report** — invoices issued, billed vs collected vs outstanding, by category
- **Revenue report** — collections by payment mode and by source (consultation, lab, product, therapy)

OP consultation fees collected at registration show under revenue as **Consultation** (`OP_VISIT`).

### 6.9 Inventory

Stock and device catalogue. **Direct “sell to patient” from inventory was removed**; sales go through billing.

- Overview
- Item master (SKU, name, category, price, low-stock threshold, device fields such as model / serial / warranty / colour)
- Stock report (on-hand units and value, low stock)
- Sales report (from billed product lines)
- Stock entry (purchase, return, damage, adjustment)
- Suppliers

Stock movements stay in PostgreSQL; product sales decrement stock when billed as `PRODUCT`.

### 6.10 Documents

Upload and store patient documents (audiograms, lab reports, prescriptions, referrals, assessments). Files live in object storage; metadata and access logs live in Postgres.

### 6.11 Communication

Outbound **WhatsApp** for clinic events (reminders, invoices, receipts).

Flow: business event → NestJS event → BullMQ `whatsapp` queue → provider → delivery status → `communication_messages`.

Staff can see queued / sent / delivered / failed messages. WhatsApp credentials never go to the browser.

### 6.12 AI assistance

AI is an **assistance layer only**. It must not silently write clinical records.

Pipeline: **AI → draft → human review → approve/edit → final record**.

Current capabilities:

- Audio **transcription** (ElevenLabs)
- **SOAP-style note draft** from transcript
- **Therapy case summary** draft (Gemini), from notes and attendance — still a draft until reviewed
- Usage and request history in the AI console

Rules:

- No `AI → direct database write` of a final clinical note
- AI output is labelled as AI-generated
- Provider keys stay on the server
- Usage is audited

### 6.13 Reports

Dedicated **Reports** module with a sidebar dropdown. Each report opens as an **A4 letterhead preview** (clinic name, address, period) with **Print / Save PDF**. Date range: daily, weekly, monthly, custom.

| Report | Contents |
|---|---|
| Clinical | OP cases, follow-ups, prescriptions, top diagnoses |
| OP visits | Visit register for the period |
| Therapy | Active cases, sessions, missed, package use, attendance |
| Lab | Executed tests and catalogue |
| Billing | Invoices, billed / collected / outstanding |
| Revenue | Collections by mode and source |
| Stock | On-hand stock and value |
| Sales | Product sales by item |
| AI usage | Requests and tokens by provider |

Operational copies of billing/revenue/stock/sales reports also remain under Billing and Inventory, with a link into the printable report.

### 6.14 Administration

- **Users** — staff accounts, staff type (doctor, therapist, reception, billing, inventory)
- **Roles** — database-driven roles and permission matrix
- **Audit** — who did what, when, on which patient/record (`PATIENT_VIEWED`, `INVOICE_CREATED`, `PERMISSION_CHANGED`, `AI_SUMMARY_GENERATED`, and similar)
- **Settings** — clinic letterhead (name, logo text, address, phone, email, GSTIN, state), invoice title and terms, default tax, currency, UI theme

---

## 7. End-to-end clinic journeys

### New walk-in consultation

Reception → New OP registration → demographics → consultation fee + payment → OP case + paid invoice → optional receipt print → fee appears on Revenue (Consultation).

### Returning OP patient

Reception → OP review registration → existing patient → consultation fee + payment → new OP visit on the same patient.

### Start therapy

Patient must already be OP-registered → Therapy registration → therapist + package → sessions generated from frequency → upcoming sessions: attendance and notes → package sessions decrement on use → packages can also be billed from New billing.

### Sell a hearing aid or lab test

Billing → New billing → Product or Lab → patient → catalogue lines → Cash/UPI/Card → invoice + payment → stock decreases for products → lab dashboard counts billed tests.

---

## 8. Non-negotiable product rules

1. **AI never silently becomes the clinical record.** Human review is required.
2. **Authorization is on the backend**, not only hidden menus.
3. **Sensitive actions are auditable** (actor, action, patient, entity, result, metadata).
4. **Business logic lives in API domain services**, not in React screens.
5. **External AI and WhatsApp secrets never reach the browser.**
6. **API is versioned** (`/api/v1/`).
7. **One billing engine** — do not invent a second cashier per module.
8. **Files are not stored as database blobs.**

---

## 9. What is explicitly out of v1

Do not treat these as missing bugs; they are deferred:

- Multi-clinic / multi-branch
- Patient portal and mobile apps
- Online patient payments (UPI/card **in clinic** is supported; public payment links are not)
- SMS/email automation beyond what WhatsApp already covers
- Teleconsultation
- Insurance / TPA
- NABH/NABL workflows
- FHIR / HL7 and external HIS/LIS integration

---

## 10. Repository map

| Path | Role |
|---|---|
| `apps/web` | React clinic UI |
| `apps/api` | NestJS API and workers |
| `prisma/` | Schema, migrations, seeds |
| `packages/` | Shared types and tooling |
| `LOGIN.md` | Local demo accounts |
| `HIS-Lite-Architecture-and-User-Stories.md` | Original specification and user stories |
| `doctor_allocation.md` | Notes on assigning doctors to slots/sessions |

---

## 11. How to think about the product

MediOne is the **operating system of one clinic day**:

- Reception puts the patient on the books and collects the consultation fee.
- Doctors document the OP visit.
- Therapists run packaged programmes with attendance and notes.
- Lab and inventory are catalogues that **bill through the same cashier**.
- Management sees money (billing/revenue), stock, and clinical volume through printable reports.
- AI speeds up documentation but never replaces the clinician’s sign-off.

If a new feature does not fit Patient, OP, Therapy, Lab, Inventory, or the central invoice, it probably does not belong in this product yet.
