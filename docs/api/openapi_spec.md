# API Specification (OpenAPI) — HIS-Lite

**Phase 0 Deliverable #4** — Maintained alongside backend implementation (§48, §35)

## 1. Global Conventions

- **Base path:** `/api/v1`
- **Auth:** `Authorization: Bearer <jwt>` (access token) + HttpOnly secure cookie (refresh token)
- **Versioning:** URL path only (`/api/v1/`). No header-based versioning.
- **Response envelope:**
  ```json
  { "data": <T>, "meta": { "page", "limit", "total" } }
  ```
- **Error envelope (RFC 7807):**
  ```json
  { "type": "https://...", "title": "...", "status": 400, "detail": "...", "instance": "/api/v1/..." }
  ```
- **Idempotency:** `Idempotency-Key` header required for POST/PUT on financial endpoints.
- **Pagination:** `?page=1&limit=20` (max 100)
- **Filtering:** `?filter[field]=value` (exact), `?filter[field][$gte]=value` (operators)
- **Sorting:** `?sort=field,-otherField`
- **Include:** `?include=relation1,relation2` (eager load)

## 2. API Groups (matching §35)

```
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

## 3. Key Endpoints (representative, not exhaustive)

### `/api/v1/auth`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | /login | Email/mobile + password → access+refresh tokens | public |
| POST | /logout | Revoke refresh token | authenticated |
| POST | /refresh | Rotate access token via refresh cookie | public (with cookie) |
| POST | /forgot-password | Request reset email | public |
| POST | /reset-password | Token + new password | public |

### `/api/v1/users`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | / | Paginated list | users.view |
| POST | / | Create user | users.create |
| GET | /:id | Get user | users.view |
| PATCH | /:id | Update user | users.edit |
| DELETE | /:id | Disable user | users.disable |
| POST | /:id/roles | Assign role | users.manage |
| DELETE | /:id/roles/:roleId | Remove role | users.manage |
| POST | /:id/permissions | Grant/deny permission | users.manage |

### `/api/v1/roles`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | / | List roles | roles.view |
| POST | / | Create custom role | roles.manage |
| PATCH | /:id | Update role | roles.manage |
| DELETE | /:id | Delete custom role | roles.manage |
| POST | /:id/permissions | Grant permission | roles.manage |
| DELETE | /:id/permissions/:permId | Revoke permission | roles.manage |

### `/api/v1/patients`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | / | Search/list (q, phone, patientNumber) | patients.view |
| POST | / | Register new patient | patients.create |
| GET | /:id | Patient profile + timeline | patients.view |
| PATCH | /:id | Update patient | patients.edit |
| GET | /:id/timeline | Unified timeline events | patients.timeline.view |
| POST | /:id/documents | Upload document | documents.upload |
| GET | /:id/documents | List documents | documents.view |

### `/api/v1/appointments`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | / | List (date range, provider, status) | appointments.view |
| POST | / | Book appointment (prevents double-book) | appointments.create |
| GET | /:id | Get appointment | appointments.view |
| PATCH | /:id | Reschedule/cancel | appointments.edit |
| POST | /:id/check-in | Patient check-in | reception.check_in |
| GET | /slots | Available slots for provider/date | appointments.view |

### `/api/v1/reception`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /queue | Today's waiting queue | reception.queue.manage |
| PATCH | /queue/:id/call | Call next patient | reception.queue.manage |
| PATCH | /queue/:id/complete | Mark completed | reception.queue.manage |

### `/api/v1/clinical`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | /op-cases | Create OP case | clinical.op.create |
| GET | /op-cases/:id | Get OP case | clinical.op.view |
| POST | /op-cases/:id/visits | Add visit | clinical.op.create |
| POST | /op-cases/:id/diagnoses | Add diagnosis | clinical.diagnosis.create |
| POST | /op-cases/:id/prescriptions | Create prescription | clinical.prescription.create |
| POST | /op-cases/:id/followups | Add follow-up | clinical.followup.create |

### `/api/v1/therapy`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | /cases | Create therapy case | therapy.case.create |
| GET | /cases/:id | Get case with packages/sessions | therapy.case.view |
| POST | /packages | Create therapy package | therapy.package.create |
| POST | /cases/:id/packages | Assign package to patient | therapy.package.assign |
| POST | /cases/:id/sessions/generate | Auto-generate sessions from package | therapy.session.create |
| GET | /sessions | List sessions (date, therapist, status) | therapy.session.view |
| PATCH | /sessions/:id | Reschedule/cancel session | therapy.session.reschedule |
| POST | /sessions/:id/attendance | Mark attendance | therapy.attendance.mark |
| POST | /sessions/:id/notes | Create therapist note (SOAP) | therapy.note.create |
| PATCH | /notes/:id | Edit note | therapy.note.edit |
| POST | /cases/:id/ai-summary | Generate AI summary | ai.summary.generate |
| PATCH | /ai-summaries/:id/review | Therapist reviews AI summary | ai.review |

### `/api/v1/billing`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | /invoices | Generate invoice | billing.invoice.create |
| GET | /invoices | List with filters | billing.invoice.view |
| GET | /invoices/:id | Get invoice with items | billing.invoice.view |
| POST | /invoices/:id/payments | Record payment (partial allowed) | billing.payment.create |
| POST | /invoices/:id/refund | Process refund | billing.refund |
| POST | /invoices/:id/send-whatsapp | Send via WhatsApp | communication.send |

### `/api/v1/inventory`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /products | List products | inventory.product.view |
| POST | /products | Create product | inventory.product.create |
| PATCH | /products/:id | Update product | inventory.product.create |
| POST | /stock/transactions | Record stock movement | inventory.stock.manage |
| GET | /low-stock | Low stock report | inventory.lowstock.view |

### `/api/v1/documents`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | / | Upload (pre-signed S3 URL returned) | documents.upload |
| GET | /:id/download | Get download URL | documents.download |
| GET | /:id/access-log | View access history | documents.view |

### `/api/v1/communication`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /messages | List with status | communication.view |
| POST | /messages | Send ad-hoc message | communication.send |
| GET | /templates | List templates | communication.view |
| POST | /templates | Create template | communication.send |
| POST | /webhook/whatsapp | WhatsApp provider webhook | public (verified) |

### `/api/v1/ai`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | /therapy-summary | Generate therapy history summary | ai.summary.generate |
| POST | /transcribe | Sarvam STT (audio upload) | ai.transcribe |
| POST | /note-draft | AI note draft from transcript | ai.note_draft |
| GET | /usage | AI usage/cost stats (admin) | ai.review |

### `/api/v1/dashboard`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /widgets | Widget registry | dashboard.view |
| GET | /layout | Current user's layout | dashboard.view |
| PATCH | /layout | Save drag-drop layout | dashboard.manage |
| GET | /metrics | Real-time metrics for widgets | dashboard.view |

### `/api/v1/reports`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /clinical | Clinical reports | reports.view |
| GET | /therapy | Therapy reports | reports.view |
| GET | /financial | Financial reports | reports.view |
| GET | /inventory | Inventory reports | reports.view |
| GET | /export/:type | CSV/PDF export | reports.export |

### `/api/v1/settings`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | / | All settings (grouped) | settings.view |
| PATCH | /:key | Update setting | settings.manage |

### `/api/v1/audit`
| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /logs | Paginated audit logs | audit.view |

## 4. Webhook Contracts

### WhatsApp Provider Webhook (`/api/v1/communication/webhook/whatsapp`)
**Payload:**
```json
{
  "messageId": "wamid.xxx",
  "status": "sent|delivered|read|failed",
  "timestamp": "2026-08-14T10:30:00Z",
  "recipient": "+91XXXXXXXXXX"
}
```
**Verification:** HMAC signature header (`X-WhatsApp-Signature`) validated against secret.

## 5. OpenAPI Generation

- NestJS `@nestjs/swagger` decorators on all controllers/DTOs
- `swagger.yaml` generated at build time → served at `/api/docs`
- CI validates no breaking changes vs previous release (oasdiff)

## 6. Rate Limits (configurable via `settings`)

| Tier | Requests/min | Scope |
|------|--------------|-------|
| Auth | 10 | /auth/* |
| Standard | 100 | All authenticated |
| AI | 20 | /ai/* |
| WhatsApp webhook | 500 | /communication/webhook/whatsapp |