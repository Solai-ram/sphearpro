# HIS-Lite Database Specification (Table-by-Table)

**Generated from:** `prisma/schema.prisma` — the database source of truth (Phase 0 #1)  
**Engine:** PostgreSQL 15+ (Prisma Client)  
**Conventions:**
- All tables use `cuid` string primary keys (except enums).
- All tables have `createdAt` (default `now()`) and mutable `updatedAt` where entity mutates.
- Soft-delete via `isDeleted`/`isActive` flags where business data must be retained (documents, products, roles).
- Money stored as `Decimal(10,2)`; percentages/tax as `Decimal(5,2)`.
- JSON columns (`Json` type) for flexible structured data (address, goals, metadata, vitals).
- Indexes on all foreign-key columns and common query filters.

---

## 1. AUTH DOMAIN

### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| username | String? | UNIQUE | Optional login handle |
| email | String | UNIQUE, NOT NULL | Primary login |
| mobile | String? | UNIQUE | For OTP/recovery |
| passwordHash | String | NOT NULL | Argon2 (never bcrypt) |
| name | String | NOT NULL | Display name |
| status | enum | DEFAULT ACTIVE | ACTIVE, SUSPENDED, INACTIVE |
| staffType | enum? | | ADMIN, DOCTOR, THERAPIST, RECEPTIONIST, BILLING, INVENTORY, OTHER |
| createdAt | DateTime | DEFAULT now() | |
| updatedAt | DateTime | auto | |
| lastLoginAt | DateTime? | | For audit / session expiry |

**Indexes:** `status`  
**Relations:** 1→many `user_roles`, `user_permissions`, `audit_logs`, `patient_documents` (uploadedBy), `document_access_logs` (accessor)

---

### roles
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| name | String | UNIQUE, NOT NULL | e.g. "Senior Therapist" |
| description | String? | | |
| isSystem | Boolean | DEFAULT false | System roles (Admin, Doctor, etc.) not deletable |
| createdAt / updatedAt | DateTime | | |

**Relations:** 1→many `user_roles`, `role_permissions`, `dashboard_layouts` (roleId)

---

### permissions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| name | String | UNIQUE, NOT NULL | e.g. `therapy.session.create` |
| module | String | NOT NULL | e.g. `therapy`, `billing` (for grouping) |
| action | String | NOT NULL | `view`, `create`, `edit`, `delete`, `manage` |
| description | String? | | |
| createdAt | DateTime | DEFAULT now() | |

**Indexes:** `module`  
**Seed data:** 1 permission per (module × action) combination across all 19 API modules.

---

### user_roles
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| userId | String (cuid) | FK→users.id, CASCADE | |
| roleId | String (cuid) | FK→roles.id, CASCADE | |
| createdAt | DateTime | DEFAULT now() | |

**Unique:** `(userId, roleId)`  
**Indexes:** `userId`, `roleId`

---

### role_permissions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| roleId | String (cuid) | FK→roles.id, CASCADE | |
| permissionId | String (cuid) | FK→permissions.id, CASCADE | |
| granted | Boolean | DEFAULT true | Allows negative grants at role level |

**Unique:** `(roleId, permissionId)`  
**Indexes:** `roleId`

---

### user_permissions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| userId | String (cuid) | FK→users.id, CASCADE | |
| permissionId | String (cuid) | FK→permissions.id, CASCADE | |
| granted | Boolean | NOT NULL | Explicit per-user override (deny takes priority) |

**Unique:** `(userId, permissionId)`  
**Indexes:** `userId`  
**Rule:** User-level DENY overrides role-level GRANT (evaluated in permission service).

---

## 2. PATIENT DOMAIN

### patients
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientNumber | String | UNIQUE, NOT NULL | Generated sequence, e.g. `P-2026-00001` |
| name | String | NOT NULL | |
| dateOfBirth | DateTime? | | For age calc |
| gender | enum? | | MALE, FEMALE, OTHER, UNKNOWN |
| phone | String? | UNIQUE | Primary contact |
| alternatePhone | String? | | |
| email | String? | UNIQUE | |
| address | Json? | | {street, city, state, pincode, country} |
| emergencyContact | Json? | | {name, phone, relationship} |
| createdAt / updatedAt | DateTime | | |
| createdBy | String? | FK→users.id | Auditor |

**Indexes:** `name`, `phone`  
**Central entity:** Linked by appointments, op_cases, therapy_cases, invoices, payments, documents, audit_logs.

---

### patient_timeline_events
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| eventType | enum | NOT NULL | APPOINTMENT, OP_VISIT, THERAPY_SESSION, ATTENDANCE, THERAPY_NOTE, PRESCRIPTION, DOCUMENT, INVOICE, PAYMENT, OTHER |
| referenceId | String | NOT NULL | ID of source entity |
| title | String | NOT NULL | Human-readable |
| description | String? | | |
| occurredAt | DateTime | NOT NULL | Event timestamp |
| metadata | Json? | | |

**Indexes:** `(patientId, occurredAt)`  
**Purpose:** Unified patient timeline view (US-PATIENT-005) — populated via domain events, not manually.

---

## 3. STAFF DOMAIN

### staff_profiles
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| userId | String? | UNIQUE, FK→users.id | If staff is a system user |
| name | String | NOT NULL | |
| staffType | enum | NOT NULL | Same enum as User.staffType |
| specialization | String? | | |
| department | String? | | |
| phone / email | String? | | |
| isProvider | Boolean | DEFAULT false | Doctors/therapists who take appointments |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `staffType`  
**Relations:** appointments (provider), therapy_cases (therapist), therapy_sessions (therapist), op_cases (provider), therapy_notes, schedules.

---

### provider_schedules
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| staffId | String (cuid) | FK→staff_profiles.id, CASCADE | |
| dayOfWeek | Int | 0–6 (0=Sunday) | |
| startTime | String | "HH:MM" | |
| endTime | String | "HH:MM" | |
| isAvailable | Boolean | DEFAULT true | |

**Indexes:** `(staffId, dayOfWeek)`  
**Used for:** Appointment slot availability checks (US-APPT-002 double-booking prevention).

---

## 4. APPOINTMENT DOMAIN

### appointments
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| providerId | String (cuid) | FK→staff_profiles.id | |
| appointmentAt | DateTime | NOT NULL | Start time |
| durationMin | Int | DEFAULT 30 | |
| status | enum | DEFAULT BOOKED | BOOKED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED |
| reason / notes | String? | | |
| createdAt / updatedAt | DateTime | | |
| createdBy | String? | FK→users.id | |

**Unique:** `(providerId, appointmentAt)` ← **Prevents double-booking at DB level (§469)**  
**Indexes:** `patientId`, `appointmentAt`  
**Note:** Appointment ≠ consultation (US-CLIN-001 OP visit is separate entity).

---

### appointment_status_history
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| appointmentId | String (cuid) | FK→appointments.id, CASCADE | |
| status | enum | NOT NULL | Same enum as appointments.status |
| changedAt | DateTime | DEFAULT now() | |
| changedBy | String? | FK→users.id | |
| note | String? | | |

**Indexes:** `appointmentId`

---

### queue_items
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| appointmentId | String? | FK→appointments.id, SET NULL | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| tokenNumber | Int | NOT NULL | Display token |
| position | Int | NOT NULL | Queue order |
| status | enum | DEFAULT WAITING | WAITING, CALLED, IN_CONSULTATION, COMPLETED, LEFT |
| checkedInAt | DateTime | DEFAULT now() | |
| calledAt / completedAt | DateTime? | | |

**Indexes:** `(status, position)`  
**Purpose:** Reception queue board (US-REC-002/003).

---

## 5. CLINICAL DOMAIN

### op_cases
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| providerId | String (cuid) | FK→staff_profiles.id | |
| chiefComplaint | String? | | |
| vitals | Json? | | {temp, bp, hr, weight, height, spo2} |
| status | enum | DEFAULT OPEN | OPEN, CLOSED |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `patientId`  
**Relations:** visits, diagnoses, clinical_notes, prescriptions, follow_ups.

### op_visits / diagnoses / clinical_notes
Standard 1→many from op_cases. `diagnoses.type` enum (PRIMARY, SECONDARY); `diagnoses.code` holds ICD-10.

### prescriptions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| opCaseId | String (cuid) | FK→op_cases.id, CASCADE | |
| notes | String? | | |
| createdAt | DateTime | DEFAULT now() | |
| createdBy | String? | FK→users.id | |

**Items:** `prescription_items` (drugName, dosage, frequency, duration, instructions).

### follow_ups
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| opCaseId | String (cuid) | FK→op_cases.id, CASCADE | |
| dueDate | DateTime | NOT NULL | |
| reason | String? | | |
| status | enum | DEFAULT PENDING | PENDING, COMPLETED, CANCELLED |

**Indexes:** `(opCaseId, dueDate)`

---

## 6. THERAPY DOMAIN

### therapy_cases
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| therapistId | String (cuid) | FK→staff_profiles.id | |
| title | String | NOT NULL | |
| assessment | String? | | |
| goals | Json? | | Array of {text, targetDate, status} |
| status | enum | DEFAULT ACTIVE | ACTIVE, COMPLETED, DISCONTINUED |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `patientId`

### therapy_types / therapy_packages
- `therapy_types`: {id, name UNIQUE, description, isActive}
- `therapy_packages`: {id, therapyTypeId FK, name, totalSessions, frequency, price Decimal(10,2), validityDays?, isActive}

**frequency enum:** WEEKLY, TWICE_WEEKLY, THREE_TIMES_WEEKLY, DAILY, EVERY_TWO_WEEKS, MONTHLY, CUSTOM

### patient_packages
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| therapyCaseId | String (cuid) | FK→therapy_cases.id, CASCADE | |
| packageId | String (cuid) | FK→therapy_packages.id | |
| totalSessions | Int | NOT NULL | Snapshot from package at purchase |
| usedSessions | Int | DEFAULT 0 | Incremented on attendance |
| expiryDate | DateTime? | | Computed from validityDays |
| purchasedAt | DateTime | DEFAULT now() | |

**Indexes:** `(patientId, therapyCaseId)`  
**Rule:** `remainingSessions = totalSessions - usedSessions` (computed in service).

### therapy_sessions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| therapyCaseId | String (cuid) | FK→therapy_cases.id, CASCADE | |
| patientPackageId | String? | FK→patient_packages.id, SET NULL | NULL = billed separately (§775/776) |
| therapistId | String (cuid) | FK→staff_profiles.id | |
| scheduledAt | DateTime | NOT NULL | |
| status | enum | DEFAULT SCHEDULED | SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED, NO_SHOW |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `(therapyCaseId, scheduledAt)`, `therapistId`  
**Billing link:** `invoice_items.referenceId` → therapy_session.id when billed session-wise.

### therapy_attendance
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| sessionId | String (cuid) | UNIQUE FK→therapy_sessions.id, CASCADE | |
| status | enum | NOT NULL | PRESENT, ABSENT, CANCELLED, RESCHEDULED, LATE |
| markedAt | DateTime | DEFAULT now() | |
| markedBy | String? | FK→users.id | |

**Rule:** Attendance and billing are independent (§774). Marking PRESENT increments `patient_packages.usedSessions`.

### therapy_notes (SOAP)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| sessionId | String (cuid) | FK→therapy_sessions.id, CASCADE | |
| therapistId | String (cuid) | FK→staff_profiles.id | |
| subjective / objective / activities / observations / progress / challenges / nextPlan | String? | | SOAP structure (§638) |
| isAiDraft | Boolean | DEFAULT false | Flag AI-generated (§30) |
| aiReviewed | Boolean | DEFAULT false | Therapist approval gate |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `sessionId`

### therapy_progress / therapy_ai_summaries
- `therapy_progress`: {id, therapyCaseId FK, recordedAt, metric, value Decimal(10,2), note}
- `therapy_ai_summaries`: {id, therapyCaseId FK, content, isReviewed, reviewedBy, reviewedAt, aiRequestId?}

**Rule (§698, §30):** AI summary must be `isReviewed=true` before treated as final clinical record.

---

## 7. BILLING DOMAIN

### invoices
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| invoiceNumber | String | UNIQUE, NOT NULL | Generated sequence |
| issueDate | DateTime | DEFAULT now() | |
| dueDate | DateTime? | | |
| status | enum | DEFAULT PENDING | PENDING, PARTIALLY_PAID, PAID, REFUNDED, CANCELLED |
| subtotal | Decimal(10,2) | NOT NULL | |
| discountTotal | Decimal(10,2) | DEFAULT 0 | |
| taxTotal | Decimal(10,2) | DEFAULT 0 | |
| grandTotal | Decimal(10,2) | NOT NULL | |
| notes | String? | | |

**Indexes:** `(patientId, issueDate)`  
**Rule:** Invoice ≠ Payment (§777). One invoice → many payments.

### invoice_items
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| invoiceId | String (cuid) | FK→invoices.id, CASCADE | |
| billableType | enum | NOT NULL | OP_VISIT, THERAPY_PACKAGE, THERAPY_SESSION, PRODUCT, OTHER |
| referenceId | String? | | Links to op_case / patient_package / therapy_session / product |
| description | String | NOT NULL | |
| quantity | Int | DEFAULT 1 | |
| unitPrice | Decimal(10,2) | NOT NULL | |
| discount | Decimal(10,2) | DEFAULT 0 | |
| tax | Decimal(10,2) | DEFAULT 0 | |
| lineTotal | Decimal(10,2) | NOT NULL | |

**Central billing engine source (§27):** All billables normalized into invoice_items.

### payments
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| invoiceId | String (cuid) | FK→invoices.id, CASCADE | |
| amount | Decimal(10,2) | NOT NULL | |
| method | enum | NOT NULL | CASH, CARD, UPI, NET_BANKING, WALLET, OTHER |
| status | enum | DEFAULT SUCCESS | SUCCESS, FAILED, PENDING, REFUNDED |
| paidAt | DateTime | DEFAULT now() | |
| reference | String? | | Gateway txn ID |
| createdBy | String? | FK→users.id | |

**Indexes:** `(invoiceId, paidAt)`  
**Partial payments (US-BILL-002):** Multiple payments per invoice allowed.

### payment_allocations / refunds / discounts
- `payment_allocations`: {id, paymentId FK, invoiceId FK, amount} — for split payments across invoices
- `refunds`: {id, invoiceId FK, paymentId? FK, amount, reason, status, refundedAt, createdBy}
- `discounts`: {id, name, type (PERCENTAGE/FIXED), value, isActive, validFrom?, validTo?}

---

## 8. INVENTORY DOMAIN

### products / product_categories / suppliers
- `products`: {id, sku UNIQUE, name, categoryId FK, description?, unitPrice Decimal(10,2), taxRate Decimal(5,2) DEFAULT 0, lowStockThreshold Int, isActive, createdAt, updatedAt}
- `product_categories`: {id, name UNIQUE, parentId?} — self-referential hierarchy
- `suppliers`: {id, name, contact?, email?, phone?, isActive}

**Rule (§778):** Stock maintained through stock_transactions (no `currentStock` column on product — always derived from running balance).

### stock_transactions
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| productId | String (cuid) | FK→products.id, CASCADE | |
| supplierId | String? | FK→suppliers.id | |
| type | enum | NOT NULL | PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT |
| quantity | Int | NOT NULL | + for in, − for out |
| balance | Int | NOT NULL | Running balance after txn |
| unitCost | Decimal(10,2)? | | |
| reference | String? | | Invoice/PO ID |
| note | String? | | |
| createdAt | DateTime | DEFAULT now() | |
| createdBy | String? | FK→users.id | |

**Indexes:** `(productId, createdAt)`  
**Low stock (US-INV-004):** `balance < lowStockThreshold`.

---

## 9. DOCUMENTS DOMAIN

### patient_documents
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String (cuid) | FK→patients.id, CASCADE | |
| category | enum | NOT NULL | AUDIOGRAM, LAB_REPORT, PRESCRIPTION, REFERRAL, THERAPY_ASSESSMENT, SCANNED, OTHER |
| fileName | String | NOT NULL | Original name |
| s3Key | String | UNIQUE, NOT NULL | S3 object key |
| mimeType | String | NOT NULL | |
| sizeBytes | Int | NOT NULL | |
| uploadedById | String? | FK→users.id | |
| uploadedAt | DateTime | DEFAULT now() | |
| isDeleted | Boolean | DEFAULT false | Soft delete |

**Indexes:** `patientId`  
**Storage (§34):** File in S3; metadata here. No blobs in Postgres.

### document_access_logs
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| documentId | String (cuid) | FK→patient_documents.id, CASCADE | |
| accessedById | String? | FK→users.id | |
| accessedAt | DateTime | DEFAULT now() | |
| action | String | | VIEW, DOWNLOAD |
| ipAddress | String? | | |

**Indexes:** `documentId`

---

## 10. COMMUNICATION DOMAIN

### communication_messages
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| patientId | String? | FK→patients.id, SET NULL | |
| templateId | String? | FK→message_templates.id | |
| type | enum | NOT NULL | APPOINTMENT_REMINDER, THERAPY_REMINDER, PAYMENT_RECEIPT, INVOICE, GENERIC |
| channel | enum | NOT NULL | WHATSAPP, SMS, EMAIL |
| to | String | NOT NULL | Phone/email |
| content | String | NOT NULL | Resolved template |
| status | enum | DEFAULT QUEUED | QUEUED, SENT, DELIVERED, READ, FAILED |
| providerMsgId | String? | | WhatsApp provider message ID |
| sentAt / deliveredAt / readAt / failedAt | DateTime? | | Delivery timeline |
| failureReason | String? | | |
| referenceType / referenceId | String? | | Links to appointment/invoice/payment |
| createdAt / updatedAt | DateTime | | |

**Indexes:** `(patientId, status)`, `(referenceType, referenceId)`  
**Webhook (§28):** Provider webhook updates status → `communication_events` audit.

### message_templates / communication_events
- `message_templates`: {id, name UNIQUE, type, language DEFAULT 'en', body (with {{vars}}), isActive}
- `communication_events`: {id, eventType, payload Json, processedAt} — raw event log for retry/replay

---

## 11. AI DOMAIN

### ai_requests / ai_outputs / ai_usage / ai_provider_configs
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| ai_requests.id | String (cuid) | PK | |
| ai_requests.type | enum | NOT NULL | THERAPY_SUMMARY, VOICE_TRANSCRIPTION, NOTE_DRAFT, PROGRESS_SUMMARY |
| ai_requests.provider | String | | "openrouter" / "sarvam" |
| ai_requests.model | String? | | |
| ai_requests.status | enum | DEFAULT PENDING | PENDING, PROCESSING, COMPLETED, FAILED |
| ai_outputs.content | String | | AI-generated text (marked isReviewed) |
| ai_usage.costUsd | Decimal(10,6)? | | For cost tracking |
| ai_provider_configs | | | Config only — **no secrets in DB** (stored in env/secret manager) |

**Safety boundary (§30, §1207):** AI outputs never written directly to clinical tables. Flow: AI → `ai_outputs` → human review → final `therapy_notes`/`therapy_ai_summaries`.

---

## 12. ADMIN DOMAIN

### dashboard_widgets / dashboard_layouts / settings
- `dashboard_widgets`: {id, key UNIQUE, title, description?, category enum, isSystem}
- `dashboard_layouts`: {id, roleId? FK, userId? FK, widgetId FK, positionX, positionY, width, height, isVisible}
  - Unique: `(roleId, widgetId)`, `(userId, widgetId)`
- `settings`: {id, key UNIQUE, value Json, group DEFAULT 'general'}

**Purpose:** Drag-drop dashboard builder (US-ADMIN-002), role-specific views (US-ADMIN-003).

---

## 13. AUDIT DOMAIN

### audit_logs
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String (cuid) | PK | |
| actorId | String? | FK→users.id, SET NULL | |
| actorType | String? | | "user" / "system" / "ai" |
| action | String | NOT NULL | PATIENT_VIEWED, THERAPY_NOTE_CREATED, AI_SUMMARY_GENERATED, INVOICE_CREATED, PAYMENT_RECEIVED, etc. |
| entityType | String? | | "patient", "invoice", "therapy_note" |
| entityId | String? | | |
| patientId | String? | FK→patients.id, SET NULL | Clinical context |
| ipAddress / userAgent | String? | | |
| result | String | DEFAULT SUCCESS | SUCCESS / FAILURE |
| metadata | Json? | | Relevant metadata |
| createdAt | DateTime | DEFAULT now() | |

**Indexes:** `(action, createdAt)`, `(entityType, entityId)`, `patientId`  
**Required events (§33):** PATIENT_VIEWED, PATIENT_UPDATED, THERAPY_NOTE_CREATED/UPDATED, AI_SUMMARY_GENERATED, INVOICE_CREATED, PAYMENT_RECEIVED, PAYMENT_REFUNDED, DOCUMENT_VIEWED, PERMISSION_CHANGED, USER_CREATED.

---

## Cross-Cutting Constraints

1. **Cascade rules:** Patient deletion cascades to all child clinical/financial records (clinic requires full history — soft-delete recommended instead of hard delete for clinical entities).
2. **Decimal precision:** Money = `Decimal(10,2)`; tax/percent = `Decimal(5,2)`.
3. **No DB blobs:** All files → S3; only metadata in Postgres.
4. **Audit everything sensitive:** Trigger or interceptor writes to `audit_logs` for §33 events.
5. **RBAC enforced at DB-query level** via permission service, not just middleware.
6. **Unique constraints** on: `users.email`, `users.username?`, `patients.patientNumber`, `appointments.(providerId, appointmentAt)`, `invoice_items` (via invoice), `therapy_attendance.sessionId`.
