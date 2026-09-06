# Security Threat Model (STRIDE)

**Phase 0 Deliverable #10** — Covers §32, §1259–1302

---

## 1. System Boundaries

```
Internet
    │
    ����
��─────────────────────────────────────��
│  NGINX (TLS termination, WAF)       │
│  - Rate limiting                    │
│  - Security headers                 │
��──────────────��──────────────────────��
               │
    ��──────────��──────────��
    ����                    ����
��─────────��         ��─────────────��
│ React   │         │  NestJS     │
│ (SPA)   │         │  (API)      │
��────��────��         └──────��──────��
     │                     │
     │              ��──────��──────��
     │              │  PostgreSQL  │
     │              │  (Primary)   │
     │              └──────��──────��
     │                     │
     │              ��──────��──────��
     │              │    Redis     │
     │              │ (Cache/Queue)│
     │              └──────��──────��
     │                     │
     │              ��──────��──────��
     │              │  BullMQ      │
     │              │  Workers     │
     │              └──────��──────��
     │                     │
     ����              ��──────��──────��
                    │   S3/MinIO   │
                    │  (Files)     │
                    └──────────────��
```

---

## 2. Data Classification

| Classification | Examples | Protection |
|----------------|----------|------------|
| **PHI (Protected Health Info)** | Patient records, therapy notes, diagnoses, prescriptions | Encryption at rest (TDE), in transit (TLS), column-level encryption for PII, audit logging |
| **PII (Personally Identifiable Info)** | Names, phones, emails, addresses | Same as PHI + pseudonymization in logs |
| **Financial** | Invoices, payments, refunds | PCI-DSS scope if cards stored (we don't store cards — use gateway) |
| **Auth Secrets** | Password hashes, JWT secrets, API keys | Argon2, HSM/secret manager, rotation policy |
| **Operational** | Audit logs, AI usage, communication metadata | Tamper-evident storage, retention policy |

---

## 3. STRIDE Analysis

### S — Spoofing Identity

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| Credential stuffing | Attacker uses leaked credentials | Rate limit `/auth/login` (10/min/IP), account lockout after 5 failures, MFA for admin |
| Session hijacking | Stolen JWT/cookie | HttpOnly + Secure + SameSite=Strict cookies, short access token (15min), refresh token rotation, binding to IP/UA |
| API key theft | AI/WhatsApp keys exposed | Keys only in secret manager, never in code/DB, scoped per environment |
| Impersonation via SSRF | Internal service calls | No user-controlled URLs in backend; egress firewall |

### T — Tampering

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| Clinical record modification | Attacker edits therapy notes | Immutable audit trail, soft-delete only, `updatedAt` + `updatedBy` on all clinical tables, DB triggers for critical fields |
| Invoice/payment tampering | Alter amounts | `lineTotal` computed and stored, `PaymentAllocation` integrity check, refund requires admin |
| AI output injection | Malicious prompt → clinical note | AI output flagged `isAiDraft`, requires human approval, prompt sanitization |
| File upload | Malicious PDF/EXE | MIME validation, size limit (10MB), S3 virus scan (ClamAV), serve via signed URLs |
| SQL/NoSQL injection | User input in queries | Prisma ORM (parameterized), Zod validation on all DTOs |

### R — Repudiation

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| User denies action | "I didn't delete that patient" | Comprehensive audit logs (§33): who, what, when, patient, record, result, metadata; immutable append-only table |
| Admin denies permission change | "I didn't grant that role" | `PERMISSION_CHANGED` audit event with before/after |
| AI generation denial | "AI didn't write that" | `AI_SUMMARY_GENERATED` + `AI_OUTPUT_REVIEWED` with actor IDs |

### I — Information Disclosure

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| Patient data leak | Unauthorized API access | RBAC on every endpoint, row-level security (RLS) policies in Postgres for `patients`, `therapy_notes`, `invoices` |
| PII in logs | Phone/email in debug logs | Structured logging with PII redaction middleware, log level = INFO in prod |
| AI prompt leakage | Patient data sent to LLM | Prompt templates exclude raw PII; only clinical context; data processing agreement with OpenRouter |
| S3 bucket public | Misconfigured bucket | Private bucket, signed URLs with 1hr expiry, bucket policies deny public |
| Error stack traces | Debug info to client | Global exception filter returns generic messages in prod |

### D — Denial of Service

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| Login brute force | Credential stuffing | IP rate limit, CAPTCHA after 3 failures, exponential backoff |
| API flood | High request volume | NGINX rate limit (100/min auth, 1000/min standard), Redis-backed sliding window |
| WhatsApp webhook spam | Provider callback flood | Verify HMAC, rate limit webhook endpoint (500/min), idempotency |
| AI cost exhaustion | Loop generating summaries | Per-user daily token limit, cost alert, circuit breaker |
| DB connection exhaustion | Long queries | Connection pooling (PgBouncer), query timeouts (30s), read replicas for reports |

### E — Elevation of Privilege

| Threat | Scenario | Mitigation |
|--------|----------|------------|
| Role escalation | User modifies own roles | `users.manage` permission required, admin-only endpoint, audit |
| Permission bypass | Frontend hides button but API called | **All** authorization in backend guards, never trust frontend |
| AI privilege escalation | AI writes to clinical tables | AI module has **no** Prisma write access to clinical/financial tables |
| Container escape | Vulnerable base image | Distroless/minimal images, no root, read-only rootfs, security scanning |

---

## 4. Security Controls Summary

| Control | Implementation |
|---------|----------------|
| **Authentication** | JWT (RS256) + HttpOnly refresh cookie, Argon2id password hashing, MFA for admin |
| **Authorization** | RBAC + fine-grained permissions, backend guards on every route, RLS policies |
| **Transport** | TLS 1.3 everywhere, HSTS, cert pinning for mobile (future) |
| **Input Validation** | Zod schemas on all DTOs, Prisma parameterized queries |
| **Rate Limiting** | NGINX + Redis sliding window (per IP, per user, per endpoint) |
| **Audit Logging** | Immutable `audit_logs` table, structured JSON, 7-year retention |
| **Secrets** | External secret manager (HashiCorp Vault / AWS Secrets Manager), zero secrets in code/DB |
| **File Security** | S3 private, signed URLs, ClamAV scan, MIME allowlist |
| **Dependency Security** | `npm audit` in CI, Dependabot, SBOM generation |
| **Headers** | Helmet: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| **CORS** | Allowlist: only clinic domain(s), no wildcards |
| **Backup Encryption** | PGBaseBackup + GPG, S3 SSE-KMS, tested restore quarterly |
| **Penetration Testing** | Annual external, quarterly internal, before major releases |

---

## 5. Incident Response (High-Level)

| Phase | Action |
|-------|--------|
| Detect | Sentry alerts, audit log anomalies, WAF blocks |
| Contain | Revoke compromised tokens, disable user, block IP |
| Eradicate | Rotate secrets, patch vulnerability, redeploy |
| Recover | Restore from encrypted backup, verify integrity |
| Postmortem | Blameless, update threat model, add tests |

---

## 6. Compliance Mapping

| Requirement | Implementation |
|-------------|----------------|
| **HIPAA-ish** (Indian clinical context) | PHI encryption, audit logs, access controls, BAA with vendors |
| **DPDP Act 2023 (India)** | Consent at registration, right to access/delete, data minimization, breach notification |
| **PCI-DSS SAQ-A** | No card storage, payment gateway handles card data |
| **ISO 27001** | Risk register, asset inventory, access review quarterly |

---

## 7. Open Threats (Accepted Risks)

| Risk | Reason | Compensating Control |
|------|--------|---------------------|
| Sarvam/OpenRouter data processing | Required for AI features | DPA signed, minimal data sent, no PII in prompts |
| SMS/Email as 2FA fallback | MFA not universal in India | Prefer TOTP, SMS only as backup |
| Shared hosting for dev | Cost | Separate VPC, no prod data in dev |