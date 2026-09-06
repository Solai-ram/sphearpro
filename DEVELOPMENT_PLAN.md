# HIS-Lite Development Plan

**Status:** Specification-only (no code scaffolded yet)  
**Source of truth:** `HIS-Lite-Architecture-and-User-Stories.md`  
**Planned stack:** React + TS (Vite, Tailwind, shadcn/ui) / NestJS + TS (REST `/api/v1`) / PostgreSQL + Prisma / Redis / BullMQ / Docker Compose

---

## Phase 0 — Pre-Implementation Deliverables *(gate everything)*

| # | Artifact | Notes |
|---|----------|-------|
| 1 | **PostgreSQL ERD** (Prisma schema) | **Database source of truth** — design all 13 domain groups from §25 |
| 2 | Table-by-table DB specification | Column types, indexes, FKs, constraints, partitioning strategy |
| 3 | RBAC & permission matrix | Roles, permissions, role_permissions, user_permissions, drag-drop builder data model |
| 4 | API specification (OpenAPI) | Maintained alongside backend; versioned under `/api/v1/` |
| 5 | Frontend route/page map | Aligns with `apps/web/src/modules/*` structure (§6) |
| 6 | Therapy workflow specification | Session generation, rescheduling, attendance, notes, billing rules (§16, §26) |
| 7 | Billing / business-rule specification | Central billing engine, package vs session billing, partial/refund logic (§17, §27) |
| 8 | AI Gateway specification | Provider abstraction, OpenRouter/Sarvam configs, prompt templates, safety boundary (§23, §29, §30) |
| 9 | WhatsApp event/message specification | Templates, BullMQ job payloads, delivery status webhook handling (§19, §28) |
| 10 | Security threat model | STRIDE analysis, data classification, secret management, rate limits (§32) |
| 11 | Docker / dev environment | Compose file, nginx config, mailpit, seed scripts |
| 12 | Implementation task breakdown | Per-module tickets matching §41 phases |

> **Rule:** Do not start Phase 1 code until ERD (#1) and RBAC matrix (#3) are reviewed and approved.

---

## Phase 1 — Foundation *(unlocks everything)*

| Order | Component | Details |
|-------|-----------|---------|
| 1.1 | Monorepo scaffold | `apps/web` (React+Vite), `apps/api` (NestJS), `packages/{shared-types,eslint-config,tsconfig}`, `infrastructure/{docker,nginx,scripts}`, `docs/` |
| 1.2 | Docker Compose dev stack | `frontend`, `backend`, `postgres`, `redis`, `worker` (BullMQ), `nginx`, `mailpit` |
| 1.3 | Prisma + PostgreSQL | Connection pooling, migrations, seed scripts for roles/permissions |
| 1.4 | NestJS bootstrap | Modular monolith structure (§7), global pipes/filters/guards/interceptors |
| 1.5 | React bootstrap | Router, providers (TanStack Query, Zustand), Tailwind + shadcn/ui, layout system |
| 1.6 | Authentication | Login (US-AUTH-001), logout (US-AUTH-002), password reset (US-AUTH-003); JWT/session, secure cookies, rate limiting, audit on login activity |
| 1.7 | RBAC system | Database-driven roles (§8), permissions, user_roles, role_permissions, user_permissions; permission guards on every controller |
| 1.8 | Audit foundation | `audit_logs` table, interceptor for sensitive actions (§33 events), structured JSON logging |
| 1.9 | CI/CD | GitHub Actions: lint → typecheck → unit → integration → build images; PR checks; deploy preview |

**Exit criteria:** Dev stack runs locally; auth + RBAC + audit working end-to-end; CI passes on empty modules.

---

## Phase 2 — Patient Module

| User Story | Scope |
|------------|-------|
| US-PATIENT-001 | Register new patient (demographics, contacts, emergency contact) |
| US-PATIENT-002 | Search by name / phone / patient number (debounced, indexed) |
| US-PATIENT-003 | Review registration (read-only view) |
| US-PATIENT-004 | Edit patient (audit trail on every field change) |
| US-PATIENT-005 | Patient timeline — unified view: OP visits, appointments, therapy sessions, attendance, notes, prescriptions, documents, invoices, payments |
| US-DOC-001/002 | Document upload → S3, metadata in Postgres, access control via permissions |

**Backend:** `patients` module (controller, service, repository, DTOs, policies, events)  
**Frontend:** `apps/web/src/modules/patients` (list, create, detail, timeline, documents)

---

## Phase 3 — Operations

| User Story | Scope |
|------------|-------|
| US-APPT-001/002 | Book appointment with provider; prevent double-booking (DB-level advisory lock or unique constraint on provider+time) |
| US-APPT-003/004 | Reschedule / cancel with status history |
| US-APPT-005 / US-WA-001 | Appointment reminder via WhatsApp (BullMQ job 24h + 1h before) |
| US-REC-001 | Patient check-in → adds to waiting queue |
| US-REC-002 | Queue management (reorder, call next, mark no-show) |
| US-REC-003 | Token display (queue number, estimated wait) |

**Backend:** `staff` (provider schedules), `appointments`, `reception` modules  
**Frontend:** `appointments` (calendar, booking modal), `reception` (queue board, check-in)

---

## Phase 4 — Clinical (OP)

| User Story | Scope |
|------------|-------|
| US-CLIN-001 | Create OP visit (chief complaint, vitals, assessment) |
| US-CLIN-002 | Record diagnoses (ICD-10 searchable) |
| US-CLIN-003 | Create prescription (medications, dosage, duration, instructions) |
| US-CLIN-004 | Follow-up plan (date, type, notes) |

**Backend:** `clinical` module — `op_cases`, `op_visits`, `diagnoses`, `clinical_notes`, `prescriptions`, `follow_ups`  
**Frontend:** `clinical` module — OP dashboard, visit wizard, prescription pad, follow-up list

---

## Phase 5 — Therapy *(most complex domain)*

| User Story | Scope |
|------------|-------|
| US-THER-001 | Create therapy case (assessment, goals, assigned therapist) |
| US-THER-002 | Therapy packages (type, total sessions, frequency, price) |
| US-THER-003 | Assign package to patient → creates `patient_package` (total/used/remaining/expiry) |
| US-THER-004 | Auto-generate sessions from frequency (weekly, 2×/wk, 3×/wk, daily, biweekly, monthly, custom) |
| US-THER-005 | Reschedule session (maintains package session count) |
| US-THER-006 | Attendance: Present / Absent / Cancelled / Rescheduled / Late |
| US-THER-007 | Therapist notes — SOAP structure (Subjective, Objective, Activities, Observations, Progress, Challenges, Next Plan) |
| US-THER-008 | Voice notes: audio → Sarvam STT → AI formatting → therapist review → save |
| US-THER-009 | AI therapy summary: previous goals, progress, observations, recent sessions, repeated issues, current goals, attention areas — **marked AI-generated, requires therapist approval** |

**Backend:** `therapy` module — cases, types, packages, patient_packages, sessions, attendance, notes, progress, ai_summaries  
**Frontend:** `therapy` module — case wizard, package builder, session calendar, attendance grid, note editor (voice + text), AI summary panel

---

## Phase 6 — Billing & Inventory

| User Story | Scope |
|------------|-------|
| US-INV-001 | Create product (name, category, SKU, price, tax, stock) |
| US-INV-002 | Stock transactions: purchase, sale, return, damage, adjustment |
| US-INV-003 | Sell product to patient (reduces stock, creates invoice line) |
| US-INV-004 | Low-stock alerts (configurable threshold, dashboard widget) |
| US-BILL-001 | Generate invoice — billable items: OP, therapy package, individual session, products |
| US-BILL-002 | Partial payments (multiple payments per invoice) |
| US-BILL-003 | Session-wise billing (no package) |
| US-BILL-004 | Refunds with audit trail |
| US-BILL-005 | Invoice WhatsApp delivery |

**Core rule (§27):** Single billing engine — `BillableItem` → `Invoice` → `Payment` → `Receipt`; `Invoice` and `Payment` are separate entities.

**Backend:** `billing` + `inventory` modules (linked via events)  
**Frontend:** `billing` (invoice builder, payment recording), `inventory` (product CRUD, stock ledger, low-stock view)

---

## Phase 7 — Communication (WhatsApp)

| User Story | Scope |
|------------|-------|
| US-WA-001 | Appointment reminder (24h + 1h) |
| US-WA-002 | Therapy session reminder (day before + morning of) |
| US-WA-003 | Payment receipt delivery |
| US-WA-004 | Message status: sent / delivered / read / failed — visible in admin |

**Architecture (§28):** Business event → NestJS event → BullMQ `whatsapp` queue → WhatsApp worker → provider API → delivery webhook → `communication_messages` status update.

**Backend:** `communication` module — templates, message queue worker, webhook handler  
**Frontend:** `communication` — template editor, message history, status dashboard

---

## Phase 8 — AI

| User Story | Scope |
|------------|-------|
| US-AI-001 | Therapy history summary (LLM via OpenRouter) |
| US-AI-002 | Voice transcription (Sarvam AI) |
| US-AI-003 | AI note draft from transcript (SOAP structure) |
| US-AI-004 | AI Gateway abstraction (provider-agnostic) |

**Safety boundary (§30):** `AI → Draft → Human Review → Final Clinical Record` — **never** AI → direct DB write. All AI outputs marked `ai_generated: true`, require explicit approval.

**Backend:** `ai` module — gateway service, OpenRouter client, Sarvam client, prompt templates, usage tracking, audit  
**Frontend:** `ai` — summary panel, voice recorder, draft review modal

---

## Phase 9 — Admin Intelligence

| User Story | Scope |
|------------|-------|
| US-ADMIN-001 | Dashboard: patients, appointments, queue, OP, therapy, attendance, revenue, pending payments, inventory, WhatsApp, AI usage (§37) |
| US-ADMIN-002 | Drag-drop dashboard widget builder (persisted per admin) |
| US-ADMIN-003 | Role-specific dashboard visibility config |
| US-REPORT-001–004 | Clinical / therapy / financial / inventory reports (ECharts, export CSV/PDF) |

**Backend:** `dashboard` (widget registry, layouts), `reports` (aggregation queries, caching)  
**Frontend:** `dashboard` (builder, widgets), `reports` (report gallery, filters, export)

---

## Phase 10 — Production Hardening

| Area | Actions |
|------|---------|
| Security | HTTPS, strong password hashing (Argon2), secure cookies/JWT, rate limiting, input validation (Zod), backend authz on every endpoint, CORS restrictions, security headers (Helmet), secret management (Vault/Sealed Secrets), DB least-privilege users |
| Audit | Full audit log review (§33), immutable log storage, retention policy |
| Backup/Recovery | Automated encrypted PG backups (daily + WAL-G), Redis persistence, S3 versioning, DR runbook, RPO/RTO targets |
| Monitoring | Sentry (errors + performance), structured JSON logs (Loki/ELK), health checks, uptime monitoring |
| Performance | Query optimization (EXPLAIN ANALYZE), Redis caching strategy, connection pooling, pagination defaults, N+1 elimination |
| Pen-testing | External audit before go-live; fix critical/high findings |
| Deploy | Nginx reverse proxy, managed PG/Redis (RDS/ElastiCache), blue-green or canary, rollback procedure |

---

## Testing Strategy (applies every phase)

| Level | Focus | Examples |
|-------|-------|----------|
| **Unit** | Pure logic | Billing calculations, permission evaluation, therapy schedule generation, inventory math, AI prompt construction, appointment conflict detection |
| **Integration** | Cross-module flows | Patient → Appointment, Therapy → Billing, Payment → Invoice, AI → Audit |
| **E2E (Playwright)** | Golden path | Register → Book → Check-in → OP → Therapy Case → Package → Sessions → Attendance → Note → AI Summary → Invoice → Payment → WhatsApp Receipt |

**Coverage targets:** 80%+ unit on domain services; 100% on billing/permission logic; critical-path E2E runs on every PR.

---

## Development Rule (per §45)

For **each module**, in order:

1. Database schema (Prisma migration)
2. Business rules (domain service, pure TS, tested in isolation)
3. Backend service (NestJS provider, uses repository)
4. API (controller, DTOs, OpenAPI decorators)
5. Authorization (guards, policies, permission checks)
6. Tests (unit → integration)
7. React UI (pages, components, forms, tables)
8. Integration (wire UI to API, test in dev stack)
9. Audit (verify sensitive actions logged)
10. Documentation (update API spec, README, changelog)

> **Never** build large UI screens before the domain model and business rules are finalized.

---

## Module Dependency Graph (build order)

```
FOUNDATION (Phase 1)
    │
    ├─→ AUTH/RBAC + STAFF
    │       │
    │       └─→ PATIENT (Phase 2)
    │               │
    │       ��───────��───────��
    │       ��               ��
    │  APPOINTMENT       CLINICAL (Phase 3, 4)
    │       │               │
    │       └───────��───────��
    │               ��
    │            THERAPY (Phase 5)
    │               │
    │        ��──────��──────��
    │        ��             ��
    │     BILLING       DOCUMENTS (Phase 6)
    │        │
    │   ��────��────��
    │   ��         ��
    │ INVENTORY PAYMENTS
    │   │         │
    │   └────��────��
    │        ��
    │   COMMUNICATION (Phase 7)
    │        │
    │        ��
    │         AI (Phase 8)
    │        │
    │   ��────��────��
    │   ��         ��
    │ DASHBOARD  REPORTS (Phase 9)
    │   │
    │   ��
    │ SECURITY / AUDIT (Phase 10)
    │   │
    │   ��
    │ PRODUCTION
```

---

## Milestones & Suggested Timelines

| Milestone | Target | Depends on |
|-----------|--------|------------|
| Dev stack running (Phase 1.1–1.3) | Week 1 | — |
| Auth + RBAC + Audit (Phase 1.6–1.8) | Week 2 | Dev stack |
| Patient CRUD + Timeline (Phase 2) | Week 3–4 | Auth/RBAC |
| Appointments + Reception (Phase 3) | Week 4–5 | Patient |
| Clinical OP (Phase 4) | Week 5–6 | Appointments |
| Therapy core (Phase 5) | Week 6–9 | Clinical |
| Billing + Inventory (Phase 6) | Week 9–11 | Therapy |
| WhatsApp integration (Phase 7) | Week 11–12 | Billing |
| AI Gateway + features (Phase 8) | Week 12–14 | Therapy, Communication |
| Dashboard + Reports (Phase 9) | Week 14–16 | All domain modules |
| Production hardening (Phase 10) | Week 16–18 | All features |
| **MVP Release** | ~Week 18 | — |

*Adjust based on team size; phases can overlap once Foundation is solid.*

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Therapy domain complexity (session generation, rescheduling, package tracking) | High | High | Prototype session generation engine in isolation first; property-based tests for schedules |
| AI safety boundary violation | Medium | Critical | Enforce at gateway level — no DB write path for AI output; code review gate on `ai` module |
| WhatsApp provider API changes / rate limits | Medium | Medium | Abstract provider behind gateway; implement retry/backoff; queue buffering |
| Double-booking race conditions | Medium | High | DB-level unique constraint on `(provider_id, start_time, end_time)` + advisory locks |
| Data migration / schema evolution | Medium | Medium | Prisma migrations only; backward-compatible API versioning; no destructive changes without rollback plan |
| Scope creep beyond MVP | High | Medium | Strict phase gates; "Future Expansion" (§44) items explicitly parked |

---

## Next Action

**Start with Phase 0 deliverable #1:** Draft the **PostgreSQL ERD / Prisma schema** covering all 13 domain groups (§25). This is the single artifact that unblocks every subsequent phase.

Once the ERD is reviewed, proceed to:
1. RBAC/permission matrix (Phase 0 #3)
2. Monorepo + Docker scaffold (Phase 1)
3. Auth + RBAC implementation (Phase 1)

---

*This plan is derived directly from `HIS-Lite-Architecture-and-User-Stories.md` (§41 Phases, §42 Dependencies, §45 Dev Rule, §39 Testing). Update this file as decisions are made during implementation.*