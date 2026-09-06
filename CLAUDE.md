# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a **greenfield project — specification only, no code exists yet**. The repository contains a single source-of-truth document:

- `HIS-Lite-Architecture-and-User-Stories.md` — complete architecture, user stories, business rules, and roadmap for the system described below.

There is no `package.json`, no monorepo scaffold, no `README.md`, and therefore **no build/lint/test commands exist yet**. Do not invent or run them. Until scaffolding is created, treat the spec document as the definitive reference and read the relevant section before designing anything.

The project is an **AI-powered HIS-Lite clinic management system** built from scratch, covering: patient registration/history, OP/clinical cases, therapy cases with packages and recurring sessions, session-wise billing and payments, attendance, therapist notes, product sales/inventory, invoices, WhatsApp communication, RBAC, admin dashboard, and AI-assisted therapy documentation.

## Planned technology stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS + shadcn/ui |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| Tables / DnD / Charts | TanStack Table, dnd-kit, Apache ECharts |
| Backend | NestJS + TypeScript, REST under `/api/v1`, OpenAPI/Swagger |
| Database / ORM | PostgreSQL + Prisma (chosen over MongoDB — data is strongly relational) |
| Cache / Jobs | Redis, BullMQ |
| Auth / Authz | Session/token auth; **database-driven RBAC + fine-grained permissions** |
| AI | NestJS AI Gateway → OpenRouter (LLM) + Sarvam AI (speech-to-text) |
| WhatsApp / Files / PDF | WhatsApp Business API, S3-compatible storage, Puppeteer/Playwright |
| Infra | Docker Compose, Nginx, GitHub Actions CI/CD, Sentry |

## Architecture at a glance

**Modular monolith**, not microservices. Plan for service extraction later if scale demands it, but the first release is one NestJS app with one React app.

- PostgreSQL is the authoritative transactional store; Redis handles caching, queues, locks, temporary state.
- BullMQ handles long-running/background work (queues: `notifications`, `whatsapp`, `email`, `pdf`, `ai`, `reports`, `documents`).
- Files (PDFs, reports, audio) live in object storage with metadata in Postgres — never blobs in the DB. Raw audio needs a defined retention policy.
- Planned monorepo: `apps/web` (React) + `apps/api` (NestJS) + `packages/` (shared-types, eslint-config, tsconfig) + `infrastructure/` (docker, nginx, scripts) + `docs/`.
- API groups: `/api/v1/{auth, users, roles, permissions, patients, staff, appointments, reception, clinical, therapy, billing, inventory, documents, communication, ai, reports, dashboard, settings}`.
- Each backend module contains its own controller, service, data-access layer, DTOs, policies, and events.

## Core domain model (the part that's easy to get wrong)

- **Patient is the central clinical entity** with a historical timeline (OP visits, appointments, therapy sessions, attendance, notes, prescriptions, documents, invoices, payments).
- **Therapy hierarchy:** Patient → Therapy Case → Therapy Package → Patient Package (tracks total/used/remaining sessions + expiry) → Therapy Sessions → Attendance, Notes, Billing.
- **Appointment ≠ consultation** (separate entities). **Therapy package ≠ therapy session** (separate entities). **Invoice ≠ payment** (separate entities).
- **Attendance and billing are independent**: a session may be attended without being billed separately (covered by a package), or billed session-wise when no package is used.
- **One central billing engine**, not separate billing per module: all billables (OP, therapy, product) flow through a single Billable Item → Invoice → Payment → Receipt chain.
- Therapy sessions are auto-generated from package frequency: weekly, twice weekly, three times weekly, daily, every two weeks, monthly, or custom.
- Attendance statuses: Present, Absent, Cancelled, Rescheduled, Late.
- Therapist notes follow a structured SOAP-like format: Subjective, Objective, Activities, Observations, Progress, Challenges, Next Plan.
- Roles are database-driven (Admin can create custom roles), never hard-coded. Permissions are configurable per role and per user, with a drag-and-drop permission builder.

## Non-negotiable architectural rules

1. **AI is an assistance layer and must never silently write clinical records.** Pipeline is strictly: AI → Draft → human (therapist/doctor) review → Approve/Edit → final clinical record. AI output must be clearly identified as AI-generated. No `AI → direct database write`, ever.
2. **Authorization is enforced on the backend**, not just in the frontend. Permission checks, file access, and every sensitive clinical/financial/security action are audited.
3. **Sensitive actions are auditable** — audit events record who, what, when, which patient, which record, action result, and metadata (e.g. `PATIENT_VIEWED`, `THERAPY_NOTE_CREATED`, `AI_SUMMARY_GENERATED`, `INVOICE_CREATED`, `PERMISSION_CHANGED`).
4. Business logic lives in domain services, not React components. Modules communicate through well-defined services and internal events.
5. External AI and WhatsApp credentials never reach the browser.
6. API contracts are versioned (`/api/v1/`).
7. Frontend state split: TanStack Query for server state, Zustand for client/UI state (sidebar, dashboard builder, UI prefs, wizard state).

## Module dependency order (build in this order)

Foundation → Auth/RBAC + Staff → Patient → Appointment + Clinical → Therapy → Billing + Documents → Inventory + Payments → Communication → AI → Dashboard + Reports → Security/Audit → Production.

The spec recommends a per-module development rule: database schema → business rules → backend service → API → authorization → tests → React UI → integration → audit → documentation. **Do not build large UI screens before the domain model and business rules are finalized.**

## Communication + AI data flow

- **Communication:** business event → NestJS event → BullMQ → WhatsApp worker → provider → delivery status → `communication_messages` table.
- **AI:** React → NestJS AI Gateway → OpenRouter (summarization, note drafting) or Sarvam (transcription) → AI draft → human review → final clinical record. AI usage is tracked and audited.

## Next engineering deliverables

Before implementation begins, produce these artifacts in order (the **ERD is the database source of truth**; API spec is maintained alongside the backend):

1. Complete PostgreSQL ERD
2. Table-by-table database specification
3. RBAC and permission matrix
4. API specification
5. Frontend route/page map
6. Therapy workflow specification
7. Billing/business-rule specification
8. AI Gateway specification
9. WhatsApp event/message specification
10. Security threat model
11. Docker/development environment
12. Implementation task breakdown

## Future scope (do not build in v1, but don't block)

Multi-clinic/branch, patient portal, mobile apps, online payments, SMS/email automation, teleconsultation, insurance, NABH/NABL workflows, FHIR/HL7 integrations, external HIS/LIS integration.
