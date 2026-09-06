# Frontend Route/Page Map — HIS-Lite

**Phase 0 Deliverable #5** — Aligns with `apps/web/src/modules/*` (§6) and API groups (§35)

## 1. Route Structure

```
/
├── /login                                    # Public
├── /forgot-password
├── /reset-password/:token
│
├── /dashboard                                # Authenticated, role-specific
│   ├── /                                     # Admin default
│   ├── /doctor                               # Doctor view
│   ├── /therapist                            # Therapist view
│   ├── /receptionist                         # Receptionist view
│   ├── /billing                              # Billing view
│   └── /inventory                            # Inventory view
│
├── /patients
│   ├── /                                     # List + search (US-PATIENT-002)
│   ├── /new                                  # Register (US-PATIENT-001)
│   ├── /:id                                  # Profile + Timeline (US-PATIENT-003/005)
│   ├── /:id/edit                             # Edit (US-PATIENT-004)
│   └── /:id/documents                        # Documents (US-DOC-001)
│
├── /appointments
│   ├── /                                     # Calendar list
│   ├── /book                                 # Book modal (US-APPT-001)
│   ├── /:id                                  # Detail
│   └── /slots                                # Slot availability
│
├── /reception
│   ├── /queue                                # Queue board (US-REC-002/003)
│   └── /check-in/:appointmentId              # Check-in (US-REC-001)
│
├── /clinical
│   ├── /op-cases
│   │   ├── /                                 # List
│   │   ├── /new                              # New OP case
│   │   ├── /:id                              # Case detail + visits
│   │   ├── /:id/visits/new                   # Add visit
│   │   ├── /:id/diagnoses                    # Diagnoses
│   │   ├── /:id/prescriptions                # Prescriptions
│   │   └── /:id/followups                    # Follow-ups
│
├── /therapy
│   ├── /cases
│   │   ├── /                                 # List
│   │   ├── /new                              # New case (US-THER-001)
│   │   ├── /:id                              # Case detail
│   │   │   ├── /packages                     # Packages (US-THER-002/003)
│   │   │   ├── /sessions                     # Sessions (US-THER-004/005)
│   │   │   ├── /attendance                   # Attendance (US-THER-006)
│   │   │   ├── /notes                        # Notes (US-THER-007/008)
│   │   │   ├── /progress                     # Progress
│   │   │   └── /ai-summary                   # AI Summary (US-THER-009)
│   └── /packages                             # Global package library
│
├── /billing
│   ├── /invoices
│   │   ├── /                                 # List
│   │   ├── /new                              # Generate (US-BILL-001)
│   │   ├── /:id                              # Detail + payments
│   │   └── /:id/refund                       # Refund (US-BILL-004)
│   └── /payments                             # Payment history
│
├── /inventory
│   ├── /products
│   │   ├── /                                 # List
│   │   ├── /new                              # Create (US-INV-001)
│   │   ├── /:id                              # Detail
│   │   └── /:id/stock                        # Stock transactions (US-INV-002)
│   ├── /low-stock                            # Alerts (US-INV-004)
│   └── /suppliers                            # Supplier management
│
├── /documents
│   ├── /                                     # All documents (admin)
│   └── /patient/:patientId                   # Patient-specific
│
├── /communication
│   ├── /messages                             # Message history + status (US-WA-004)
│   └── /templates                            # Templates
│
├── /ai
│   ├── /therapy-summary/:caseId              # Generate/review (US-AI-001)
│   ├── /transcribe                           # Voice upload (US-AI-002)
│   └── /note-draft                           # AI draft (US-AI-003)
│
├── /reports
│   ├── /clinical                             # Clinical (US-REPORT-001)
│   ├── /therapy                              # Therapy (US-REPORT-002)
│   ├── /financial                            # Financial (US-REPORT-003)
│   └── /inventory                            # Inventory (US-REPORT-004)
│
├── /dashboard-builder                        # Admin drag-drop (US-ADMIN-002)
│
├── /users
│   ├── /                                     # List (US-USER-001)
│   ├── /:id                                  # Profile + permissions
│   └── /:id/permissions                      # Drag-drop builder (US-USER-004)
│
├── /roles
│   ├── /                                     # List
│   ├── /new                                  # Create custom role
│   └── /:id/permissions                      # Permission assignment
│
├── /audit
│   └── /logs                                 # Audit log viewer (US-AUDIT-001)
│
��── /settings
    ├── /general
    ├── /clinic
    ├── /billing
    ├── /communication
    └── /ai
```

## 2. Layout System (per §38 Role-specific Dashboards)

| Role | Layout | Visible Modules |
|------|--------|-----------------|
| ADMIN | Full sidebar | All |
| DOCTOR | Clinical-focused | Patients, Appointments, Clinical, Therapy (read), Billing (view), Documents |
| THERAPIST | Therapy-focused | Patients, Appointments (therapy), Therapy, AI, Documents |
| RECEPTIONIST | Queue-focused | Patients, Appointments, Reception, Queue |
| BILLING | Finance-focused | Patients, Billing, Inventory (sale), Communication |
| INVENTORY | Stock-focused | Inventory, Billing (product sale) |

## 3. Navigation Components

- **Sidebar:** Collapsible, role-filtered module list
- **Top bar:** User menu, notifications, search (global patient search)
- **Breadcrumbs:** On all nested routes
- **Tabs:** Within module detail pages (e.g., Therapy Case → Packages/Sessions/Notes/Progress)

## 4. State Mapping (per §36)

| Data | Store |
|------|-------|
| Patients, appointments, therapy sessions, invoices, reports, inventory | TanStack Query (server state) |
| Sidebar open/closed, dashboard builder state, UI preferences, wizard temp state | Zustand (client state) |
| Forms (all) | React Hook Form + Zod (schema from shared-types) |

## 5. Shared Component Library (`apps/web/src/components/`)

```
ui/              # shadcn/ui primitives (Button, Input, Table, Dialog, etc.)
forms/           # FormField, FormArray, DatePicker, PatientSelect, ProviderSelect
tables/          # DataTable (TanStack Table), VirtualizedTable
dialogs/         # ConfirmDialog, PatientSearchDialog, ProviderSelectDialog
charts/          # ECharts wrappers (RevenueChart, AttendanceChart, etc.)
timeline/        # PatientTimeline (vertical, filterable by eventType)
```

## 6. Route Guards

| Guard | Logic |
|-------|-------|
| `authGuard` | Redirect to `/login` if no valid access token |
| `permissionGuard` | Check `requirePermission('module.resource.action')` via backend `/auth/verify-permission` (or cached) |
| `roleGuard` | Redirect to role-specific dashboard if accessing wrong route |

## 7. API Client (`apps/web/src/services/api.ts`)

- Axios instance with baseURL `/api/v1`
- Interceptors: auth header, token refresh on 401, error normalization
- Auto-generated from OpenAPI spec (or `@hey-api/openapi-ts`)

## 8. Build/Dev

- `npm run dev` — Vite dev server + HMR
- `npm run build` — TypeScript compile + Vite production build
- `npm run preview` — Preview production build
- `npm run lint` — ESLint (shared config from `packages/eslint-config`)
- `npm run typecheck` — `tsc --noEmit`

## 9. Environment Variables (Frontend)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | `/api/v1` (dev: `http://localhost:3001/api/v1`) |
| `VITE_APP_NAME` | "HIS-Lite" |
| `VITE_ENABLE_MOCK` | `true` for Storybook/unit tests |