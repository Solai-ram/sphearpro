# RBAC & Permission Matrix (HIS-Lite)

**Phase 0 Deliverable #3** — Database-driven roles (§8, §10, §279), drag-and-drop permission builder (US-USER-004)

## 1. Model

- **Roles** are stored in `roles` table. `isSystem=true` for seeded roles (cannot be deleted).
- **Permissions** are stored in `permissions` table with `module` + `action` columns.
- **Assignment:** `user_roles` (many-to-many), `role_permissions` (many-to-many with `granted` flag).
- **Per-user override:** `user_permissions` with explicit `granted` (deny takes priority over role grants).
- **Evaluation order** (in permission service):
  1. If `user_permissions` has explicit DENY for (user, permission) → **DENY**.
  2. Else if `user_permissions` has explicit GRANT → **GRANT**.
  3. Else if any role of user has `role_permissions.granted=true` → **GRANT**.
  4. Else → **DENY**.

## 2. Seeded System Roles (initial)

| Role | Description |
|------|-------------|
| ADMIN | Full access; can create custom roles, manage users, view audit |
| DOCTOR | Clinical access: OP, prescriptions, patient view |
| THERAPIST | Therapy cases, sessions, notes, AI summaries |
| RECEPTIONIST | Patient registration, appointments, check-in, queue |
| BILLING | Invoices, payments, refunds, product sales |
| INVENTORY | Products, stock, suppliers |

Admin can create custom roles (e.g. SENIOR_THERAPIST, CLINIC_MANAGER, ACCOUNTS_MANAGER, FRONT_OFFICE).

## 3. Permission Naming Convention

```
{module}.{resource}.{action}
```

Modules (19 total, match API groups §35):
`auth, users, roles, permissions, patients, staff, appointments, reception, clinical, therapy, billing, inventory, documents, communication, ai, dashboard, reports, audit, settings`

Actions: `view`, `create`, `edit`, `delete`, `manage` (all actions), `export`, `review` (AI/human-review gates)

## 4. Permission Matrix

Legend: ✅ = granted by default for that role

### AUTH / USERS / ROLES / PERMISSIONS

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| users.view | ✅ | | | ✅ | ✅ | ✅ |
| users.create | ✅ | | | ✅ | | |
| users.edit | ✅ | | | ✅ | | |
| users.manage | ✅ | | | | | |
| users.disable | ✅ | | | | | |
| roles.view | ✅ | | | | | |
| roles.manage | ✅ | | | | | |
| permissions.view | ✅ | | | | | |
| permissions.manage | ✅ | | | | | |
| auth.reset_password | ✅ | | | ✅ | | |

### PATIENTS

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| patients.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| patients.create | ✅ | | | ✅ | | |
| patients.edit | ✅ | ✅ | ✅ | ✅ | | |
| patients.timeline.view | ✅ | ✅ | ✅ | ✅ | ✅ | |

### APPOINTMENTS / RECEPTION

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| appointments.view | ✅ | ✅ | ✅ | ✅ | | |
| appointments.create | ✅ | ✅ | ✅ | ✅ | | |
| appointments.edit | ✅ | ✅ | ✅ | ✅ | | |
| appointments.cancel | ✅ | ✅ | ✅ | ✅ | | |
| reception.check_in | ✅ | | | ✅ | | |
| reception.queue.manage | ✅ | | | ✅ | | |
| reception.token.manage | ✅ | | | ✅ | | |

### CLINICAL

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| clinical.op.create | ✅ | ✅ | | | | |
| clinical.op.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| clinical.diagnosis.create | ✅ | ✅ | | | | |
| clinical.prescription.create | ✅ | ✅ | | | | |
| clinical.followup.create | ✅ | ✅ | | | | |

### THERAPY

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| therapy.case.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| therapy.case.create | ✅ | ✅ | ✅ | | | |
| therapy.package.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| therapy.package.create | ✅ | ✅ | ✅ | ✅ | ✅ | |
| therapy.package.assign | ✅ | ✅ | ✅ | ✅ | ✅ | |
| therapy.session.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| therapy.session.create | ✅ | ✅ | ✅ | ✅ | | |
| therapy.session.reschedule | ✅ | ✅ | ✅ | ✅ | | |
| therapy.attendance.mark | ✅ | ✅ | ✅ | | | |
| therapy.note.create | ✅ | ✅ | ✅ | | | |
| therapy.note.edit | ✅ | ✅ | ✅ | | | |
| therapy.progress.record | ✅ | ✅ | ✅ | | | |

### BILLING / INVENTORY

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| billing.invoice.create | ✅ | | | | ✅ | |
| billing.invoice.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| billing.payment.create | ✅ | | | | ✅ | |
| billing.payment.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| billing.refund | ✅ | | | | ✅ | |
| inventory.product.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| inventory.product.create | ✅ | | | | | ✅ |
| inventory.stock.manage | ✅ | | | | | ✅ |
| inventory.product.sale | ✅ | | | | ✅ | ✅ |
| inventory.lowstock.view | ✅ | | | | ✅ | ✅ |

### DOCUMENTS

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| documents.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| documents.upload | ✅ | ✅ | ✅ | ✅ | | |
| documents.download | ✅ | ✅ | ✅ | ✅ | ✅ | |

### COMMUNICATION / AI

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| communication.view | ✅ | ✅ | ✅ | ✅ | ✅ | |
| communication.send | ✅ | | ✅ | ✅ | ✅ | |
| ai.summary.generate | ✅ | ✅ | ✅ | | | |
| ai.transcribe | ✅ | ✅ | ✅ | | | |
| ai.note_draft | ✅ | ✅ | ✅ | | | |
| ai.review | ✅ | ✅ | ✅ | | | |

### DASHBOARD / REPORTS / AUDIT / SETTINGS

| Permission | ADMIN | DOCTOR | THERAPIST | RECEPTIONIST | BILLING | INVENTORY |
|-----------|-------|--------|-----------|--------------|---------|-----------|
| dashboard.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| dashboard.manage | ✅ | | | | | |
| reports.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| reports.export | ✅ | ✅ | ✅ | | ✅ | ✅ |
| audit.view | ✅ | | | | | |
| settings.view | ✅ | | | | | |
| settings.manage | ✅ | | | | | |

## 5. Drag-and-Drop Permission Builder (US-USER-004)

UI groups permissions by module tree:
```
Therapy
 ├── View
 ├── Create Session
 ├── Edit Session
 ├── Attendance
 ├── Notes
 └── Billing
```
Admin drags module/feature into user's/role's access area; each capability toggleable (enable/disable → `role_permissions.granted` / `user_permissions.granted`).

## 6. Backend Enforcement (§7, §123, §784)

- **Guard:** `RequirePermissionGuard` reads `permission` from route metadata, resolves effective permission via permission service, throws `403` if denied.
- **All sensitive endpoints** require permission check — never rely on frontend hiding.
- **Auditing:** Permission changes logged to `audit_logs` (action `PERMISSION_CHANGED`, entityType `role`/`user`).

## 7. Seed Script (Phase 1)

`prisma/seed.ts` must create:
1. 6 system roles
2. All permissions from matrix (19 modules × actions)
3. Role→permission grants per matrix
4. Default ADMIN user (from env `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
