# AI-Powered HIS-Lite — Complete Architecture & User Story Specification

## 1. Document Purpose

This document defines the implementation architecture, functional scope, user stories, technical stack, security model, AI architecture, database direction, module dependencies, and implementation roadmap for a new AI-powered HIS-Lite clinic management system.

The system is designed for a clinic that handles:

- Patient registration and patient history
- OP/clinical cases
- Therapy cases
- Therapy packages and recurring sessions
- Session-wise billing and payments
- Attendance
- Therapist notes
- Product sales and inventory
- Invoice generation
- WhatsApp communication
- Role-based access
- Admin dashboard
- Configurable permissions
- AI-assisted therapy documentation and summarization

The application will be built from scratch.

---

# 2. Recommended Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| UI | Tailwind CSS + shadcn/ui |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Drag & Drop | dnd-kit |
| Charts | Apache ECharts |
| Backend | NestJS + TypeScript |
| API | REST API + OpenAPI |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache | Redis |
| Background Jobs | BullMQ |
| Authentication | Secure session/token architecture |
| Authorization | RBAC + fine-grained permissions/policies |
| AI Gateway | NestJS AI module |
| LLM | OpenRouter |
| Speech-to-text | Sarvam AI |
| WhatsApp | WhatsApp Business API/provider |
| File Storage | S3-compatible object storage |
| PDF | Puppeteer/Playwright |
| Testing | Vitest/Jest + Playwright |
| Containers | Docker |
| Reverse Proxy | Nginx |
| Monitoring | Sentry + structured logs |
| CI/CD | GitHub Actions |

## Stack Decision

The system should use PostgreSQL rather than MongoDB because the HIS has strongly relational data:

```text
Patient
 ├── Appointments
 ├── OP Visits
 ├── Therapy Cases
 │     ├── Packages
 │     ├── Sessions
 │     ├── Attendance
 │     └── Notes
 ├── Invoices
 ├── Payments
 ├── Product Sales
 └── Documents
```

The recommended architecture is a **modular monolith**, not microservices.

---

# 3. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │   Web / Tablet      │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                              HTTPS / REST
                                    │
                         ┌──────────▼──────────┐
                         │       NGINX         │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │      NestJS         │
                         │   Modular Monolith  │
                         └──────────┬──────────┘
                                    │
          ┌─────────────┬───────────┼───────────┬─────────────┐
          │             │           │           │             │
          ▼             ▼           ▼           ▼             ▼
      PostgreSQL      Redis       BullMQ      S3 Storage    AI Gateway
                                                        │
                                                ┌───────┴───────┐
                                                ▼               ▼
                                          OpenRouter         Sarvam AI
```

---

# 4. Architecture Principles

1. PostgreSQL is the authoritative source for transactional HIS data.
2. Redis is used for caching, queues, locks, and temporary state where appropriate.
3. BullMQ handles long-running/background operations.
4. Files are stored in object storage, not inside database blobs.
5. AI is an assistance layer and must not silently create clinical records.
6. Clinical AI output requires human review before becoming a final clinical record.
7. Authorization is enforced on the backend, not only in the frontend.
8. Every sensitive clinical/financial/security action should be auditable.
9. Business logic belongs in domain services, not React components.
10. Modules communicate through well-defined services and internal events.
11. API endpoints are versioned under `/api/v1`.
12. The initial deployment is a modular monolith; services can be extracted later if scale requires it.

---

# 5. Repository Structure

```text
his-lite/
│
├── apps/
│   ├── web/
│   │   └── React + TypeScript
│   │
│   └── api/
│       └── NestJS
│
├── packages/
│   ├── shared-types/
│   ├── eslint-config/
│   └── tsconfig/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── security/
│   └── ai/
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 6. Frontend Architecture

```text
apps/web/src/
├── app/
│   ├── router/
│   ├── providers/
│   ├── layouts/
│   └── config/
│
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── patients/
│   ├── appointments/
│   ├── reception/
│   ├── clinical/
│   ├── therapy/
│   ├── billing/
│   ├── inventory/
│   ├── communication/
│   ├── ai/
│   ├── reports/
│   ├── documents/
│   ├── users/
│   ├── roles/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── dialogs/
│   ├── charts/
│   └── timeline/
│
├── hooks/
├── lib/
├── services/
├── types/
└── utils/
```

---

# 7. Backend Architecture

```text
apps/api/src/
├── main.ts
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── patients/
│   ├── staff/
│   ├── appointments/
│   ├── reception/
│   ├── clinical/
│   ├── therapy/
│   ├── billing/
│   ├── inventory/
│   ├── documents/
│   ├── communication/
│   ├── notifications/
│   ├── ai/
│   ├── dashboard/
│   ├── reports/
│   ├── audit/
│   └── settings/
│
├── common/
│   ├── guards/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   ├── middleware/
│   └── utils/
│
├── database/
└── config/
```

Each business module should contain its own controller, service, repository/data-access layer, DTOs, policies and events as required.

---

# 8. User Roles

Initial roles:

- Admin
- Doctor
- Therapist
- Receptionist
- Billing
- Inventory

The system must allow Admin to create custom roles.

Examples:

- Senior Therapist
- Junior Therapist
- Clinic Manager
- Accounts Manager
- Front Office

Roles are database-driven rather than hard-coded.

---

# 9. User Stories

## 9.1 Authentication

### US-AUTH-001 — User Login

**As a** clinic staff member  
**I want to** log in securely  
**So that** I can access only the modules assigned to me.

**Acceptance Criteria**

- User can log in with valid credentials.
- Invalid credentials are rejected.
- Suspended users cannot log in.
- Session/token is created securely.
- Login activity can be audited.
- User is redirected to the appropriate dashboard.

### US-AUTH-002 — Logout

**As a** logged-in user  
**I want to** log out  
**So that** my session cannot be reused by another person.

**Acceptance Criteria**

- Session is invalidated.
- Refresh token/session is revoked.
- Protected APIs reject the invalidated session.

### US-AUTH-003 — Password Reset

**As a** user  
**I want to** reset my password  
**So that** I can regain access securely.

---

# 10. User & Permission Management User Stories

## US-USER-001 — Create User

**As an Admin**  
**I want to** create a staff user  
**So that** the staff member can access the HIS.

Admin should be able to enter:

- Name
- Mobile
- Email
- Username if required
- Staff type
- Role
- Status

---

## US-USER-002 — Assign Role

**As an Admin**  
**I want to** assign a role to a user  
**So that** the user receives appropriate permissions.

---

## US-USER-003 — Custom Permissions

**As an Admin**  
**I want to** customize individual permissions  
**So that** access can be tailored to the user's responsibility.

---

## US-USER-004 — Drag-and-Drop Permission Builder

**As an Admin**  
**I want to** drag modules/features into a user's or role's access area  
**So that** permission configuration is easy.

Example:

```text
Therapy
 ├── View
 ├── Create Session
 ├── Edit Session
 ├── Attendance
 ├── Notes
 └── Billing
```

Admin can enable/disable each capability.

---

## US-USER-005 — Disable User

**As an Admin**  
**I want to** deactivate a user  
**So that** former/inactive staff cannot access the system.

---

# 11. Patient Registration User Stories

## US-PATIENT-001 — Register New Patient

**As a Receptionist**  
**I want to** register a new patient  
**So that** the clinic has a unique patient record.

Patient information:

- Patient number
- Name
- Date of birth
- Gender
- Phone
- Alternate phone
- Email
- Address
- Emergency contact
- Other required demographic information

---

## US-PATIENT-002 — Search Patient

**As a staff member**  
**I want to** search patients by name, phone, or patient number  
**So that** I can quickly find an existing patient.

---

## US-PATIENT-003 — Review Patient Registration

**As a staff member**  
**I want to** review a patient's registration information  
**So that** I can verify the patient's identity and contact information.

---

## US-PATIENT-004 — Edit Patient

**As an authorized staff member**  
**I want to** update patient information  
**So that** the record remains accurate.

Changes should be auditable.

---

# 12. Patient Timeline User Story

## US-PATIENT-005 — View Patient Timeline

**As a Doctor or Therapist**  
**I want to** view the patient's historical timeline  
**So that** I can understand the patient's previous interactions with the clinic.

Timeline may include:

- OP visits
- Appointments
- Therapy sessions
- Attendance
- Therapist notes
- Prescriptions
- Documents
- Invoices
- Payments

---

# 13. Appointment User Stories

## US-APPT-001 — Book Appointment

**As a Receptionist**  
**I want to** book an appointment  
**So that** the patient can be scheduled with a doctor or therapist.

---

## US-APPT-002 — Prevent Double Booking

**As the system**  
**I want to** prevent overlapping appointments  
**So that** two patients cannot be assigned to the same provider at the same time.

---

## US-APPT-003 — Reschedule Appointment

**As an authorized staff member**  
**I want to** reschedule an appointment  
**So that** changes are reflected in the clinic schedule.

---

## US-APPT-004 — Cancel Appointment

**As an authorized staff member**  
**I want to** cancel an appointment  
**So that** the appointment no longer occupies the schedule.

---

## US-APPT-005 — Appointment Reminder

**As a patient**  
**I want to** receive an appointment reminder through WhatsApp  
**So that** I do not miss my appointment.

---

# 14. Reception User Stories

## US-REC-001 — Patient Check-in

**As a Receptionist**  
**I want to** check in an arriving patient  
**So that** the patient enters the clinic queue.

---

## US-REC-002 — Queue Management

**As a Receptionist**  
**I want to** view and manage the waiting queue  
**So that** patients are processed efficiently.

---

## US-REC-003 — Token Management

**As a Receptionist**  
**I want to** assign/display queue tokens  
**So that** patient flow is clear.

---

# 15. OP / Clinical User Stories

## US-CLIN-001 — Create OP Visit

**As a Doctor**  
**I want to** create an OP consultation record  
**So that** the clinical encounter is documented.

---

## US-CLIN-002 — Record Diagnosis

**As a Doctor**  
**I want to** record diagnoses  
**So that** the patient's clinical history is maintained.

---

## US-CLIN-003 — Create Prescription

**As a Doctor**  
**I want to** create a prescription  
**So that** the patient's treatment instructions are documented.

---

## US-CLIN-004 — Follow-up

**As a Doctor**  
**I want to** create a follow-up plan  
**So that** future care can be scheduled.

---

# 16. Therapy User Stories

## US-THER-001 — Create Therapy Case

**As a Therapist/Doctor**  
**I want to** create a therapy case for a patient  
**So that** ongoing therapy can be managed separately from normal appointments.

---

## US-THER-002 — Create Therapy Package

**As an authorized staff member**  
**I want to** create therapy packages  
**So that** services can be sold as a defined number of sessions.

Example:

```text
Speech Therapy
20 Sessions
Weekly
₹15,000
```

---

## US-THER-003 — Assign Package

**As authorized staff**  
**I want to** assign a package to a patient  
**So that** the patient's therapy entitlement is tracked.

---

## US-THER-004 — Generate Sessions

**As the system**  
**I want to** generate therapy sessions from package frequency  
**So that** recurring sessions can be scheduled automatically.

Supported frequencies:

- Weekly
- Twice weekly
- Three times weekly
- Daily
- Every two weeks
- Monthly
- Custom

---

## US-THER-005 — Reschedule Therapy Session

**As a Therapist/Receptionist**  
**I want to** reschedule a session  
**So that** the patient's therapy plan can continue despite scheduling changes.

---

## US-THER-006 — Mark Attendance

**As a Therapist**  
**I want to** mark session attendance  
**So that** completed and missed sessions are tracked.

Statuses:

- Present
- Absent
- Cancelled
- Rescheduled
- Late

---

## US-THER-007 — Record Therapist Note

**As a Therapist**  
**I want to** record a note for each therapy session  
**So that** the patient's progress is documented.

Suggested structure:

```text
Subjective
Objective
Activities
Observations
Progress
Challenges
Next Plan
```

---

## US-THER-008 — Voice Therapy Note

**As a Therapist**  
**I want to** speak my therapy notes instead of typing everything  
**So that** documentation is faster.

Workflow:

```text
Voice
 ↓
Sarvam AI
 ↓
Transcript
 ↓
AI formatting/draft
 ↓
Therapist review
 ↓
Save
```

---

## US-THER-009 — Therapy History Summary

**As a Therapist**  
**I want to** generate an AI summary of previous therapy sessions  
**So that** I can quickly understand long-term progress.

The system should summarize:

- Previous goals
- Progress
- Important observations
- Recent sessions
- Repeated issues
- Current goals
- Areas requiring attention

AI output must be marked as AI-generated and reviewed by the therapist before being treated as a final clinical record.

---

# 17. Billing User Stories

## US-BILL-001 — Generate Invoice

**As Billing staff**  
**I want to** generate an invoice  
**So that** the patient receives an official bill.

Billable items include:

- OP consultation
- Therapy package
- Individual therapy session
- Products
- Other configured services

---

## US-BILL-002 — Partial Payment

**As Billing staff**  
**I want to** record partial payments  
**So that** outstanding balances remain accurate.

---

## US-BILL-003 — Session-wise Payment

**As Billing staff**  
**I want to** bill individual therapy sessions  
**So that** clinics that do not use packages can still collect session-wise payments.

---

## US-BILL-004 — Refund

**As an authorized Billing/Admin user**  
**I want to** process refunds  
**So that** cancelled/eligible transactions can be reversed with proper audit history.

---

## US-BILL-005 — Invoice WhatsApp

**As Billing staff**  
**I want to** send an invoice through WhatsApp  
**So that** the patient receives the bill immediately.

---

# 18. Product & Inventory User Stories

## US-INV-001 — Create Product

**As Inventory staff**  
**I want to** create products sold by the clinic  
**So that** products can be tracked and billed.

---

## US-INV-002 — Stock Management

**As Inventory staff**  
**I want to** record purchases, sales, returns, damage, and adjustments  
**So that** inventory remains accurate.

---

## US-INV-003 — Sell Product

**As Billing staff**  
**I want to** sell a product to a patient  
**So that** the product sale is invoiced and inventory is reduced.

---

## US-INV-004 — Low Stock Alert

**As an Admin/Inventory user**  
**I want to** see low-stock products  
**So that** stock can be replenished before running out.

---

# 19. WhatsApp User Stories

## US-WA-001 — Appointment Reminder

**As a patient**  
**I want to** receive an appointment reminder  
**So that** I remember my appointment.

---

## US-WA-002 — Therapy Reminder

**As a therapy patient**  
**I want to** receive a session reminder  
**So that** I remember recurring therapy sessions.

---

## US-WA-003 — Payment Receipt

**As a patient**  
**I want to** receive my payment receipt  
**So that** I have proof of payment.

---

## US-WA-004 — Message Status

**As an Admin**  
**I want to** see whether a WhatsApp message was sent, delivered, read, or failed  
**So that** communication can be monitored.

---

# 20. Admin Dashboard User Stories

## US-ADMIN-001 — View Overall Dashboard

**As an Admin**  
**I want to** view all important clinic metrics in one dashboard  
**So that** I can understand the current operational state.

Dashboard should include:

- Patients
- Appointments
- Waiting queue
- OP visits
- Therapy sessions
- Attendance
- Revenue
- Pending payments
- Inventory
- WhatsApp status
- AI usage

---

## US-ADMIN-002 — Dashboard Customization

**As an Admin**  
**I want to** drag and drop dashboard widgets  
**So that** the dashboard matches my operational needs.

---

## US-ADMIN-003 — Role-specific Dashboard

**As an Admin**  
**I want to** configure dashboard visibility by role  
**So that** users see only relevant information.

---

# 21. Reports User Stories

## US-REPORT-001 — Clinical Reports

Admin/authorized users should be able to view:

- Patient statistics
- OP visits
- Diagnoses
- Follow-ups
- Provider utilization

---

## US-REPORT-002 — Therapy Reports

Reports should include:

- Active therapy cases
- Sessions
- Attendance
- Missed sessions
- Package utilization
- Therapist workload
- Progress metrics

---

## US-REPORT-003 — Financial Reports

Reports should include:

- Revenue
- Payments
- Outstanding
- Refunds
- Discounts
- OP revenue
- Therapy revenue
- Product revenue

---

## US-REPORT-004 — Inventory Reports

Reports should include:

- Stock
- Low stock
- Product sales
- Stock movement
- Adjustments

---

# 22. Documents User Stories

## US-DOC-001 — Upload Patient Document

**As an authorized user**  
**I want to** upload a patient document  
**So that** it is available in the patient's history.

Examples:

- Audiogram
- Lab report
- Prescription
- Referral
- Therapy assessment
- Scanned documents

---

## US-DOC-002 — Secure Document Access

**As the system**  
**I want to** protect patient documents using authorization  
**So that** only permitted staff can access them.

---

# 23. AI User Stories

## US-AI-001 — Therapy Summary

**As a Therapist**  
**I want to** summarize previous therapy records using AI  
**So that** I can quickly understand the patient's history.

---

## US-AI-002 — Voice Transcription

**As a Therapist**  
**I want to** dictate notes using voice  
**So that** I can reduce typing.

---

## US-AI-003 — AI Note Draft

**As a Therapist**  
**I want to** convert a transcript into a structured therapy-note draft  
**So that** I can review and finalize it faster.

---

## US-AI-004 — AI Provider Abstraction

**As the system owner**  
**I want AI providers to be abstracted behind an AI Gateway**  
**So that** OpenRouter/Sarvam can be replaced or extended without rewriting business modules.

---

# 24. Audit User Stories

## US-AUDIT-001 — Record Sensitive Actions

**As an Admin**  
**I want to** see important system activity  
**So that** sensitive clinical, financial, and security actions are traceable.

Audit events include:

- Patient record access
- Patient changes
- Therapy note changes
- Invoice creation
- Payment
- Refund
- Permission changes
- User creation
- Document access
- AI generation

---

# 25. Core Database Domains

The detailed ERD will be designed around these groups:

```text
AUTH
├── users
├── roles
├── permissions
├── user_roles
├── role_permissions
└── user_permissions

PATIENT
├── patients
└── patient_contacts / related demographic entities as required

STAFF
├── staff_profiles
└── provider schedules

APPOINTMENT
├── appointments
├── appointment_status_history
└── schedules

CLINICAL
├── op_cases
├── op_visits
├── diagnoses
├── clinical_notes
├── prescriptions
├── prescription_items
└── follow_ups

THERAPY
├── therapy_cases
├── therapy_types
├── therapy_packages
├── patient_packages
├── therapy_sessions
├── therapy_attendance
├── therapy_notes
├── therapy_progress
└── therapy_ai_summaries

BILLING
├── invoices
├── invoice_items
├── payments
├── payment_allocations
├── refunds
└── discounts

INVENTORY
├── products
├── product_categories
├── suppliers
└── stock_transactions

DOCUMENTS
├── patient_documents
└── document_access_logs

COMMUNICATION
├── communication_messages
├── message_templates
└── communication_events

AI
├── ai_requests
├── ai_outputs
├── ai_usage
└── ai_provider_configs

ADMIN
├── dashboard_widgets
├── dashboard_layouts
└── settings

AUDIT
└── audit_logs
```

---

# 26. Therapy Data Relationship

```text
PATIENT
   │
   ▼
THERAPY CASE
   │
   ├── Assessment
   │
   ├── Goals
   │
   └── Package
         │
         ▼
   PATIENT PACKAGE
         │
         ├── Total Sessions
         ├── Used Sessions
         ├── Remaining Sessions
         └── Expiry
                │
                ▼
          THERAPY SESSIONS
                │
          ┌─────┼─────┐
          ▼     ▼     ▼
      Attendance Notes Billing
                    │
                    ▼
                   AI
```

---

# 27. Central Billing Model

All billable services should use one billing engine.

```text
                  BILLABLE ITEM
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
            OP       THERAPY    PRODUCT
             │         │         │
             └─────────┼─────────┘
                       ▼
                    INVOICE
                       │
                       ▼
                    PAYMENT
                       │
                       ▼
                    RECEIPT
```

This avoids separate billing implementations for OP, therapy and products.

---

# 28. Communication Architecture

```text
Business Event
      │
      ▼
NestJS Event
      │
      ▼
BullMQ
      │
      ▼
WhatsApp Worker
      │
      ▼
WhatsApp Provider
      │
      ▼
Delivery Status
      │
      ▼
communication_messages
```

---

# 29. AI Architecture

```text
                         React
                           │
                           ▼
                         NestJS
                           │
                      AI Gateway
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
       OpenRouter                     Sarvam AI
          LLM                            STT
            │                             │
            ▼                             ▼
     Summarization                  Transcription
     Note generation                     │
     Progress summary                    ▼
            │                       Transcript
            └──────────────┬──────────────┘
                           ▼
                      AI Draft
                           │
                           ▼
                    Human Review
                           │
                           ▼
                  Final Clinical Record
```

---

# 30. AI Clinical Safety Boundary

The system must never use:

```text
AI → Direct database write
```

Instead:

```text
AI
 ↓
Draft
 ↓
Therapist/Doctor Review
 ↓
Approve/Edit
 ↓
Final Clinical Record
```

AI-generated information must be clearly identified.

---

# 31. Background Processing

BullMQ queues:

```text
notifications
whatsapp
email
pdf
ai
reports
documents
```

Example:

```text
Invoice Generated
       │
       ▼
BullMQ
   ┌───┴────────────┐
   ▼                ▼
Generate PDF      WhatsApp
```

---

# 32. Security Architecture

```text
HTTPS
  │
  ▼
NGINX
  │
  ▼
NestJS
  │
  ├── Authentication
  │
  ├── Authorization
  │
  ├── Validation
  │
  ├── Rate Limiting
  │
  └── Audit
       │
       ▼
   PostgreSQL
```

Security requirements:

- HTTPS
- Secure authentication
- Strong password hashing
- Secure cookies/tokens
- Rate limiting
- Input validation
- Backend authorization
- Permission checks
- File access authorization
- Audit logs
- Secure secrets
- CORS restrictions
- Security headers
- Backup encryption
- Database access restrictions
- Least privilege

---

# 33. Audit Requirements

Sensitive operations must record:

```text
Who
What
When
Which patient
Which record
Action result
Relevant metadata
```

Examples:

```text
PATIENT_VIEWED
PATIENT_UPDATED
THERAPY_NOTE_CREATED
THERAPY_NOTE_UPDATED
AI_SUMMARY_GENERATED
INVOICE_CREATED
PAYMENT_RECEIVED
PAYMENT_REFUNDED
DOCUMENT_VIEWED
PERMISSION_CHANGED
USER_CREATED
```

---

# 34. Storage Architecture

```text
                    PostgreSQL
                        │
                 Document Metadata
                        │
                        ▼
                S3-compatible Storage
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
      Reports         PDFs            Audio
```

Do not store large files directly in PostgreSQL.

Raw audio should have a defined retention policy and should not be retained unnecessarily.

---

# 35. API Architecture

All public APIs should be versioned:

```text
/api/v1/
```

Main API groups:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/permissions
/api/v1/patients
/api/v1/staff
/api/v1/appointments
/api/v1/reception
/api/v1/clinical
/api/v1/therapy
/api/v1/billing
/api/v1/inventory
/api/v1/documents
/api/v1/communication
/api/v1/ai
/api/v1/reports
/api/v1/dashboard
/api/v1/settings
```

OpenAPI/Swagger should be maintained as part of the backend.

---

# 36. Frontend State Strategy

Use **TanStack Query** for server state:

- Patients
- Appointments
- Therapy sessions
- Invoices
- Reports
- Inventory

Use **Zustand** for client/UI state:

- Sidebar
- Dashboard builder
- UI preferences
- Temporary wizard state

Use **React Hook Form + Zod** for forms.

---

# 37. Dashboard Architecture

Admin dashboard should expose:

### Patient

- New patients
- Total patients
- Active cases

### Operations

- Today's appointments
- Waiting patients
- Completed appointments
- No-shows

### Therapy

- Active therapy cases
- Sessions today
- Attendance
- Package utilization
- Therapist workload

### Finance

- Today's revenue
- Pending payments
- Therapy revenue
- Product revenue
- Refunds

### Inventory

- Low stock
- Out-of-stock
- Product sales

### Communication

- WhatsApp sent
- Delivered
- Read
- Failed

### AI

- AI summaries
- Transcriptions
- AI requests
- Usage/cost where provider data supports it

---

# 38. Role-specific Dashboard

### Admin

Full operational dashboard.

### Doctor

- Today's appointments
- OP queue
- Patients
- Follow-ups
- Clinical history

### Therapist

- Today's sessions
- Attendance
- Pending notes
- Active therapy cases
- AI summaries

### Receptionist

- Appointments
- Check-in
- Waiting queue
- Patient registration

### Billing

- Invoices
- Payments
- Outstanding
- Product sales

### Inventory

- Stock
- Low stock
- Purchases
- Product movement

---

# 39. Testing Strategy

## Unit Tests

Test:

- Billing calculations
- Permission evaluation
- Therapy schedule generation
- Inventory calculations
- AI prompt construction
- Appointment conflict detection

## Integration Tests

Test:

```text
Patient → Appointment
Therapy → Billing
Payment → Invoice
AI → Audit
```

## End-to-End Tests

Golden path:

```text
Register Patient
      ↓
Book Appointment
      ↓
Check-in
      ↓
OP Consultation
      ↓
Create Therapy Case
      ↓
Purchase Package
      ↓
Generate Sessions
      ↓
Attend Session
      ↓
Record Therapist Note
      ↓
Generate AI Summary
      ↓
Invoice
      ↓
Payment
      ↓
WhatsApp Receipt
```

---

# 40. Deployment

## Development

```text
Docker Compose
├── frontend
├── backend
├── postgres
├── redis
├── worker
├── nginx
└── mailpit
```

## Production

```text
Internet
    │
    ▼
Nginx / Load Balancer
    │
    ├── React static assets
    │
    └── NestJS API
          │
     ┌────┴──────────────┐
     ▼                   ▼
PostgreSQL             Redis
     │                   │
     ▼                   ▼
  Backup               BullMQ
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
             AI       WhatsApp    Email
```

Production PostgreSQL and Redis should preferably be managed services once the system becomes business-critical.

---

# 41. Implementation Phases

## Phase 1 — Foundation

- Monorepo
- Docker
- React
- NestJS
- PostgreSQL
- Redis
- CI/CD
- Authentication
- RBAC
- Audit foundation

## Phase 2 — Patient

- Registration
- Search
- Profile
- Review
- Edit
- Timeline
- Documents

## Phase 3 — Operations

- Staff
- Appointment
- Scheduler
- Reception
- Check-in
- Queue

## Phase 4 — Clinical

- OP
- Diagnosis
- Prescription
- Follow-up
- Clinical history

## Phase 5 — Therapy

- Therapy cases
- Therapy types
- Packages
- Session generation
- Scheduling
- Attendance
- Therapist notes
- Progress

## Phase 6 — Billing & Inventory

- Products
- Inventory
- Invoices
- Payments
- Refunds
- Product sales
- Session billing
- Package billing

## Phase 7 — Communication

- WhatsApp
- Appointment reminders
- Therapy reminders
- Invoice delivery
- Receipts
- Communication history

## Phase 8 — AI

- AI Gateway
- OpenRouter
- Sarvam
- Therapy summaries
- Voice transcription
- AI note drafting
- AI audit

## Phase 9 — Admin Intelligence

- Admin dashboard
- Dashboard builder
- Reports
- Analytics
- AI usage

## Phase 10 — Production Hardening

- Security review
- Audit review
- Backup/recovery
- Performance
- Monitoring
- Disaster recovery
- Penetration testing
- Production deployment

---

# 42. Module Dependency

```text
                         FOUNDATION
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
          AUTH/RBAC                      STAFF
             │                             │
             └──────────────┬──────────────┘
                            ▼
                         PATIENT
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
            APPOINTMENT             CLINICAL
                 │                     │
                 └──────────┬──────────┘
                            ▼
                         THERAPY
                            │
                     ┌──────┴──────┐
                     ▼             ▼
                  BILLING       DOCUMENTS
                     │
               ┌─────┴─────┐
               ▼           ▼
          INVENTORY    PAYMENTS
               │           │
               └─────┬─────┘
                     ▼
                COMMUNICATION
                     │
                     ▼
                     AI
                     │
              ┌──────┴──────┐
              ▼             ▼
          DASHBOARD       REPORTS
              │
              ▼
       SECURITY / AUDIT
              │
              ▼
          PRODUCTION
```

---

# 43. Important Business Rules

1. Appointment and consultation are different entities.
2. Patient is the central clinical entity.
3. Therapy package and therapy session are different entities.
4. Attendance and billing are independent.
5. A session may be attended without being billed separately if covered by a package.
6. A session may be billed separately when the patient does not use a package.
7. Invoice and payment are separate.
8. Product stock is maintained through stock transactions.
9. AI output is never automatically treated as final clinical documentation.
10. Permission checks are enforced on the backend.
11. Sensitive actions are auditable.
12. Documents are stored outside the relational database.
13. Long-running external operations use queues.
14. External AI and WhatsApp credentials never reach the browser.
15. All API contracts are versioned.

---

# 44. Future Expansion

The architecture should leave room for:

- Multi-clinic / multi-branch
- Patient portal
- Mobile application
- Doctor portal
- Therapist mobile app
- Online payments
- SMS
- Email automation
- Advanced analytics
- AI-powered clinical search
- AI progress comparison
- Appointment optimization
- Teleconsultation
- Insurance
- NABH/NABL-related workflows where applicable
- Integration with external HIS/LIS systems
- FHIR/HL7 integrations where required

These should not be implemented in the first release unless required, but the architecture should avoid blocking them.

---

# 45. Recommended Development Rule

For each module:

```text
1. Database schema
        ↓
2. Business rules
        ↓
3. Backend service
        ↓
4. API
        ↓
5. Authorization
        ↓
6. Tests
        ↓
7. React UI
        ↓
8. Integration
        ↓
9. Audit
        ↓
10. Documentation
```

Do not build large UI screens before the domain model and business rules are finalized.

---

# 46. MVP Definition

The first production-capable version should contain:

```text
AUTH
✓ Login
✓ Users
✓ Roles
✓ Permissions

PATIENT
✓ Registration
✓ Search
✓ Profile
✓ Timeline

OPERATIONS
✓ Appointments
✓ Check-in
✓ Queue

CLINICAL
✓ OP
✓ Diagnosis
✓ Prescription
✓ Follow-up

THERAPY
✓ Cases
✓ Packages
✓ Sessions
✓ Attendance
✓ Notes
✓ Progress

BILLING
✓ Invoice
✓ Payments
✓ Package billing
✓ Session billing
✓ Product billing

INVENTORY
✓ Products
✓ Stock
✓ Sales

COMMUNICATION
✓ WhatsApp reminders
✓ Invoice
✓ Receipt

AI
✓ Therapy summary
✓ Sarvam transcription
✓ AI note draft

ADMIN
✓ Dashboard
✓ User management
✓ Permission builder
✓ Reports
✓ Audit logs
```

---

# 47. Final Architecture

```text
                                  ┌─────────────────────┐
                                  │     PATIENT /       │
                                  │ STAFF / ADMIN       │
                                  └──────────┬──────────┘
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │ React + TypeScript  │
                                  │ Tailwind + shadcn   │
                                  └──────────┬──────────┘
                                             │
                                            HTTPS
                                             │
                                  ┌──────────▼──────────┐
                                  │        NGINX         │
                                  └──────────┬──────────┘
                                             │
                                  ┌──────────▼──────────┐
                                  │       NestJS         │
                                  │   Modular Monolith   │
                                  └──────────┬──────────┘
                                             │
       ┌──────────────┬────────────┬─────────┼───────────┬──────────────┐
       │              │            │         │           │              │
       ▼              ▼            ▼         ▼           ▼              ▼
   PATIENT         CLINICAL      THERAPY   BILLING    INVENTORY     RECEPTION
       │              │            │         │           │              │
       └──────────────┴────────────┴─────────┴───────────┴──────────────┘
                                             │
                                      DOMAIN EVENTS
                                             │
                       ┌─────────────────────┼───────────────────┐
                       │                     │                   │
                       ▼                     ▼                   ▼
                 COMMUNICATION             AI                DASHBOARD
                       │                     │                   │
                       ▼              ┌──────┴──────┐            │
                    BullMQ             ▼             ▼            │
                       │          OpenRouter      Sarvam          │
                       │             LLM           STT            │
                       │              │             │             │
                       └──────────────┴─────────────┘             │
                                      │                           │
                                      ▼                           │
                               HUMAN REVIEW                       │
                                      │                           │
                                      ▼                           │
                              CLINICAL RECORD ◄───────────────────┘

                    ┌─────────────────────────────────┐
                    │           DATA LAYER             │
                    │ PostgreSQL │ Redis │ S3 Storage │
                    └─────────────────────────────────┘

                    ┌─────────────────────────────────┐
                    │       SECURITY / AUDIT           │
                    │ RBAC │ Policies │ Audit │ Logs   │
                    └─────────────────────────────────┘
```

---

# 48. Next Engineering Deliverables

Before implementation begins, produce these documents/artifacts in order:

1. **Complete PostgreSQL ERD**
2. **Table-by-table database specification**
3. **RBAC and permission matrix**
4. **API specification**
5. **Frontend route/page map**
6. **Therapy workflow specification**
7. **Billing/business-rule specification**
8. **AI Gateway specification**
9. **WhatsApp event/message specification**
10. **Security threat model**
11. **Docker/development environment**
12. **Implementation task breakdown**

The **ERD should be treated as the database source of truth**, and the API specification should be generated/maintained alongside the backend implementation.
