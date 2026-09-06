# Phase 4 Implementation Guide: Clinical, Therapy & Billing

## Overview

Phase 4 covers three major interconnected modules:
1. **Clinical (OP)** - Consultation records, diagnoses, prescriptions, follow-ups
2. **Therapy** - Cases, packages, sessions, attendance, notes, AI summaries
3. **Billing** - Central invoice system for all billable items

**Scope:** User stories US-CLIN-001..004, US-THER-001..009, US-BILL-001..005

---

## Module Dependencies

```
Appointments (Phase 3) ←─┐
        ↓                |
    Patients            |
        ↓                |
   Clinical ←───────────┘  (creates OP case from appointment)
        ↓
    Therapy (needs Clinical for assessment)
        ↓
    Billing (billable items from both)
```

---

## Database Schema Design

### Clinical Module Tables

```sql
model OpCase {
  id              String   @id @default(cuid())
  patientId       String
  appointmentId   String?  // Optional: linked to appointment
  providerId      String   // Doctor ID
  visitDate       DateTime
  reason          String   // Chief complaint
  history         String?  // Medical history
  findings        String?  // Examination findings
  status          OpCaseStatus @default(ACTIVE) // ACTIVE, CLOSED, REFERRED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?

  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  appointment     Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)
  provider        StaffProfile @relation(fields: [providerId], references: [id])
  diagnoses       Diagnosis[]
  prescriptions   Prescription[]
  followUps       FollowUp[]
  clinicalNotes   ClinicalNote[]

  @@index([patientId])
  @@index([providerId])
  @@index([visitDate])
  @@map("op_cases")
}

enum OpCaseStatus {
  ACTIVE
  CLOSED
  REFERRED
}

model Diagnosis {
  id          String   @id @default(cuid())
  opCaseId    String
  code        String   // ICD-10 code
  description String
  severity    Severity @default(MODERATE)
  isPrimary   Boolean  @default(false)
  createdAt   DateTime @default(now())

  opCase OpCase @relation(fields: [opCaseId], references: [id], onDelete: Cascade)

  @@index([opCaseId])
  @@map("diagnoses")
}

enum Severity {
  MILD
  MODERATE
  SEVERE
  CRITICAL
}

model Prescription {
  id          String   @id @default(cuid())
  opCaseId    String
  medicineId  String?
  medicineName String
  dosage      String   // "500mg"
  frequency   String   // "3 times daily"
  duration    String   // "5 days"
  instructions String?
  quantity    Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  opCase OpCase @relation(fields: [opCaseId], references: [id], onDelete: Cascade)
  prescriptionItems PrescriptionItem[]

  @@index([opCaseId])
  @@map("prescriptions")
}

model PrescriptionItem {
  id              String   @id @default(cuid())
  prescriptionId  String
  itemName        String
  quantity        Int

  prescription Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)

  @@index([prescriptionId])
  @@map("prescription_items")
}

model FollowUp {
  id          String   @id @default(cuid())
  opCaseId    String
  followUpDate DateTime
  reason      String   // Why follow-up is needed
  appointmentId String? // If scheduled as appointment
  status      FollowUpStatus @default(PENDING)
  notes       String?
  createdAt   DateTime @default(now())

  opCase OpCase @relation(fields: [opCaseId], references: [id], onDelete: Cascade)
  appointment Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  @@index([opCaseId])
  @@map("follow_ups")
}

enum FollowUpStatus {
  PENDING
  SCHEDULED
  COMPLETED
  CANCELLED
}

model ClinicalNote {
  id          String   @id @default(cuid())
  opCaseId    String
  note        String   // SOAP format or free text
  noteType    NoteType @default(GENERAL)
  createdAt   DateTime @default(now())
  createdBy   String?

  opCase OpCase @relation(fields: [opCaseId], references: [id], onDelete: Cascade)

  @@index([opCaseId])
  @@map("clinical_notes")
}

enum NoteType {
  GENERAL
  SUBJECTIVE
  OBJECTIVE
  ASSESSMENT
  PLAN
}
```

### Therapy Module Tables

```sql
model TherapyCase {
  id              String   @id @default(cuid())
  patientId       String
  therapistId     String
  caseType        String   // "Speech Therapy", "Physiotherapy", etc.
  assessmentDate  DateTime
  assessment      String   // Initial assessment notes
  goals           String   // Treatment goals
  status          TherapyCaseStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  therapist       StaffProfile @relation(fields: [therapistId], references: [id])
  packages        TherapyPackage[]
  sessions        TherapySession[]
  notes           TherapyNote[]
  progress        TherapyProgress[]

  @@index([patientId])
  @@index([therapistId])
  @@map("therapy_cases")
}

enum TherapyCaseStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  DISCHARGED
}

model TherapyPackage {
  id              String   @id @default(cuid())
  name            String   // "Speech Therapy Package"
  type            String   // "Speech Therapy", "Physiotherapy"
  description     String?
  totalSessions   Int
  frequency       SessionFrequency // WEEKLY, TWICE_WEEKLY, etc.
  duration        String   // "3 months", "12 weeks"
  price           Float
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patientPackages PatientPackage[]

  @@index([type])
  @@map("therapy_packages")
}

enum SessionFrequency {
  WEEKLY
  TWICE_WEEKLY
  THREE_TIMES_WEEKLY
  DAILY
  EVERY_TWO_WEEKS
  MONTHLY
  CUSTOM
}

model PatientPackage {
  id              String   @id @default(cuid())
  patientId       String
  therapyPackageId String
  therapyCaseId   String?
  totalSessions   Int
  usedSessions    Int      @default(0)
  remainingSessions Int
  expiryDate      DateTime
  status          PackageStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  therapyPackage  TherapyPackage @relation(fields: [therapyPackageId], references: [id])
  therapyCase     TherapyCase? @relation(fields: [therapyCaseId], references: [id])
  sessions        TherapySession[]

  @@index([patientId])
  @@map("patient_packages")
}

enum PackageStatus {
  ACTIVE
  EXPIRED
  COMPLETED
  CANCELLED
}

model TherapySession {
  id              String   @id @default(cuid())
  therapyCaseId   String
  patientId       String
  therapistId     String
  patientPackageId String?
  sessionDate     DateTime
  durationMin     Int      @default(60)
  attendance      AttendanceStatus @default(PENDING)
  notes           TherapyNote?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  therapyCase     TherapyCase @relation(fields: [therapyCaseId], references: [id], onDelete: Cascade)
  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  therapist       StaffProfile @relation(fields: [therapistId], references: [id])
  patientPackage  PatientPackage? @relation(fields: [patientPackageId], references: [id])
  billableItem    BillableItem?

  @@index([therapyCaseId])
  @@index([patientId])
  @@index([sessionDate])
  @@map("therapy_sessions")
}

enum AttendanceStatus {
  PENDING
  PRESENT
  ABSENT
  CANCELLED
  RESCHEDULED
  LATE
}

model TherapyNote {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  subjective      String?  // What patient reported
  objective       String?  // Observations, measurements
  activities      String?  // Therapy activities done
  observations    String?  // Behavior, progress
  progress        String?  // Goals achieved
  challenges      String?  // Barriers, issues
  nextPlan        String?  // Plan for next session
  voiceTranscript String?  // Sarvam AI transcript (if voice note)
  isAIDrafted     Boolean  @default(false) // AI generated
  aiDraft         String?  // AI draft (before review)
  isDraft         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?

  session TherapySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("therapy_notes")
}

model TherapyProgress {
  id              String   @id @default(cuid())
  therapyCaseId   String
  summary         String   // AI-generated summary
  period          String   // "Weeks 1-4", "Month 1", etc.
  sessionCount    Int
  attendanceRate  Float    // 0-100%
  goalsAchieved   String[]
  areasToFocus    String[]
  recommendations String?
  generatedAt     DateTime @default(now())
  generatedBy     String?  // AI system or therapist

  therapyCase TherapyCase @relation(fields: [therapyCaseId], references: [id], onDelete: Cascade)

  @@index([therapyCaseId])
  @@map("therapy_progress")
}
```

### Billing Module Tables

```sql
model BillableItem {
  id              String   @id @default(cuid())
  invoiceId       String?
  patientId       String
  itemType        BillableItemType
  entityId        String   // opCaseId, therapySessionId, productId, etc.
  description     String
  quantity        Int      @default(1)
  unitPrice       Float
  totalPrice      Float
  discount        Float    @default(0)
  tax             Float    @default(0)
  finalAmount     Float
  status          BillableStatus @default(PENDING)
  createdAt       DateTime @default(now())

  invoice         Invoice? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([invoiceId])
  @@map("billable_items")
}

enum BillableItemType {
  OP_CONSULTATION
  THERAPY_SESSION
  THERAPY_PACKAGE
  PRODUCT
  OTHER
}

enum BillableStatus {
  PENDING
  INVOICED
  PAID
  CANCELLED
  REFUNDED
}

model Invoice {
  id              String   @id @default(cuid())
  invoiceNumber   String   @unique // INV-2026-00001
  patientId       String
  issueDate       DateTime @default(now())
  dueDate         DateTime
  subtotal        Float
  discount        Float    @default(0)
  tax             Float    @default(0)
  total           Float
  paidAmount      Float    @default(0)
  outstanding     Float
  status          InvoiceStatus @default(ISSUED)
  notes           String?
  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient         Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  items           BillableItem[]
  payments        Payment[]

  @@index([patientId])
  @@index([invoiceNumber])
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  OVERDUE
  CANCELLED
}

model Payment {
  id              String   @id @default(cuid())
  invoiceId       String
  amount          Float
  paymentDate     DateTime @default(now())
  paymentMethod   PaymentMethod
  reference       String?  // Transaction ID, check number, etc.
  notes           String?
  createdBy       String?
  createdAt       DateTime @default(now())

  invoice         Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  receipt         Receipt?

  @@index([invoiceId])
  @@map("payments")
}

enum PaymentMethod {
  CASH
  CARD
  BANK_TRANSFER
  CHEQUE
  UPI
  OTHER
}

model Receipt {
  id              String   @id @default(cuid())
  receiptNumber   String   @unique // REC-2026-00001
  paymentId       String   @unique
  invoiceId       String
  amount          Float
  issueDate       DateTime @default(now())
  createdBy       String?

  payment         Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice         Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@map("receipts")
}

model Refund {
  id              String   @id @default(cuid())
  invoiceId       String
  paymentId       String?
  amount          Float
  reason          String
  status          RefundStatus @default(PENDING)
  processedDate   DateTime?
  notes           String?
  authorizedBy    String?
  createdAt       DateTime @default(now())

  invoice         Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@map("refunds")
}

enum RefundStatus {
  PENDING
  APPROVED
  PROCESSED
  REJECTED
  CANCELLED
}

model Discount {
  id              String   @id @default(cuid())
  type            DiscountType
  value           Float    // Amount or percentage
  code            String?  // Discount code
  maxUses         Int?
  currentUses     Int      @default(0)
  expiryDate      DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@map("discounts")
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
  PACKAGE_DISCOUNT
  LOYALTY
}
```

---

## API Endpoint Plan

### Clinical Endpoints (12 total)
```
GET     /api/v1/clinical/cases              # List OP cases
GET     /api/v1/clinical/cases/:id          # Get case detail
POST    /api/v1/clinical/cases              # Create OP case
PATCH   /api/v1/clinical/cases/:id          # Update case
GET     /api/v1/clinical/cases/:id/diagnoses
POST    /api/v1/clinical/cases/:id/diagnoses
GET     /api/v1/clinical/cases/:id/prescriptions
POST    /api/v1/clinical/cases/:id/prescriptions
GET     /api/v1/clinical/cases/:id/followups
POST    /api/v1/clinical/cases/:id/followups
PATCH   /api/v1/clinical/followups/:id      # Update follow-up status
```

### Therapy Endpoints (20+ total)
```
# Cases
GET     /api/v1/therapy/cases
POST    /api/v1/therapy/cases
GET     /api/v1/therapy/cases/:id
PATCH   /api/v1/therapy/cases/:id

# Packages
GET     /api/v1/therapy/packages
POST    /api/v1/therapy/packages
GET     /api/v1/therapy/packages/:id

# Patient Packages
POST    /api/v1/therapy/patients/:id/packages  # Assign package
GET     /api/v1/therapy/patients/:id/packages

# Sessions
GET     /api/v1/therapy/sessions
POST    /api/v1/therapy/cases/:id/sessions    # Generate sessions from package
PATCH   /api/v1/therapy/sessions/:id          # Reschedule
PATCH   /api/v1/therapy/sessions/:id/attendance
GET     /api/v1/therapy/sessions/:id/notes
POST    /api/v1/therapy/sessions/:id/notes    # Record note
POST    /api/v1/therapy/sessions/:id/voice-note # Voice to text
GET     /api/v1/therapy/cases/:id/summary     # AI summary
```

### Billing Endpoints (15+ total)
```
# Invoices
GET     /api/v1/billing/invoices
POST    /api/v1/billing/invoices
GET     /api/v1/billing/invoices/:id
PATCH   /api/v1/billing/invoices/:id
GET     /api/v1/billing/invoices/:id/items

# Payments
POST    /api/v1/billing/payments
GET     /api/v1/billing/payments/:id

# Receipts
GET     /api/v1/billing/receipts/:id

# Refunds
POST    /api/v1/billing/refunds
GET     /api/v1/billing/refunds/:id

# Reports
GET     /api/v1/billing/reports/revenue
GET     /api/v1/billing/reports/outstanding
```

---

## Implementation Sequence

### Phase 4A (Week 1): Clinical Module
1. Add database models (OpCase, Diagnosis, Prescription, FollowUp, ClinicalNote)
2. Implement clinical.service.ts (CRUD, search, relationships)
3. Implement clinical.controller.ts (REST endpoints)
4. Add authorization decorators
5. Test endpoints with Postman/curl
6. Add audit logging

### Phase 4B (Week 2): Therapy Module
1. Add database models (TherapyCase, TherapyPackage, PatientPackage, TherapySession, TherapyNote, TherapyProgress)
2. Implement therapy.service.ts (session generation, note formatting)
3. Implement therapy.controller.ts
4. Integrate with Sarvam AI for voice-to-text (optional for MVP)
5. Test workflows

### Phase 4C (Week 3): Billing Module
1. Add database models (BillableItem, Invoice, Payment, Receipt, Refund, Discount)
2. Implement billing.service.ts (invoice generation, payment tracking)
3. Implement billing.controller.ts
4. Integrate WhatsApp for invoice delivery (optional for MVP)
5. Test billing workflows

### Phase 5: Frontend Pages
1. Build Clinical pages (case list, create, detail, diagnoses, prescriptions)
2. Build Therapy pages (cases, packages, sessions, notes, progress)
3. Build Billing pages (invoices, payments, reports)

---

## Development Tips

1. **Relationships:** Therapy sessions link to therapy cases which link to therapy packages which link to patients
2. **Auto-generation:** Therapy sessions auto-generated based on package frequency
3. **Billing Coupling:** Both OP consultations and therapy sessions can generate billable items
4. **AI Integration:** TherapyNote has `isAIDrafted`, `aiDraft` fields for AI-generated drafts that require review
5. **Voice Notes:** Sarvam AI transcript stored with therapy note for audit trail
6. **Session Frequencies:** Support 7 predefined frequencies + custom cron-like patterns

---

## Test Data Needed

- At least 2 therapy package types (Speech, Physiotherapy)
- Test dates spanning 2-4 weeks for session generation testing
- Sample diagnoses with ICD-10 codes
- Sample medicines/prescriptions

---

## Next Steps

1. Run database migrations for Phase 4 models
2. Implement Clinical module service + controller
3. Test with sample OP case
4. Iterate to Therapy and Billing

**Estimated Effort:** 40-60 hours for full Phase 4 implementation + testing
