# Coverage baseline (Phase 0)

Recorded from the existing Vitest suite plus the new harness. Figures will move as more tests land.

## Already covered before this work

| Area | Files |
|---|---|
| Subscription state machine | `subscription-state.test.ts` |
| Seat limits | `subscription-seats.test.ts` |
| Razorpay / webhooks (mocked) | `razorpay.service.test.ts`, `razorpay-webhook.service.test.ts` |
| Subscription jobs / mail | `subscription-jobs.test.ts` |
| Subscription gate helper | `subscription.guard.test.ts` |
| Therapy schedule math | `session-schedule.test.ts` |
| Billing INR words | `inr-words.test.ts` |
| ICD-10 data | `icd10.data.test.ts` |
| Tenant helpers | `clinic-context.test.ts` |
| Document tenancy | `documents-tenancy.test.ts` |
| Auth throttle policy | `auth-security.policy.test.ts` |
| Web RBAC | `apps/web/src/auth/rbac.test.ts` |

## Gaps this program targets

| Module | Before | After phases 1–4 |
|---|---|---|
| Guards (Permissions, Feature, SuperAdmin, Subscription) | partial | unit tests for allow/deny/reason mapping |
| Subscription checkAccess / trial | partial | mocked + DB-backed trial expiry |
| Therapy session generation / attendance / billing linkage | schedule helpers only | DB-backed service tests |
| Billing invoice + payment | INR words only | DB-backed invoice/payment |
| Patients | none | DB create + HTTP tenancy |
| Controllers | none | Nest HTTP tests for auth/me, patients, therapy types, billing invoices |
| Workflow + audit | none | one end-to-end domain story |
| DTOs / most other modules | none | later phases |

## Latest measured baseline (API)

Vitest v8 coverage after phases 0–5 (local, with `hislite_test`):

| Metric | Value |
|---|---|
| Statements / lines | 25.26% |
| Branches | 65.82% |
| Functions | 31.96% |
| Tests | 153 passed |

Guard coverage is ~99%. Subscription, therapy, and billing services are the next largest slices. Remaining zeros: appointments, inventory, lab, roles, settings, staff.

## How to run

```bash
npm run test --workspace=apps/api
npm run test:coverage --workspace=apps/api
```

DB-backed tests run only when `DATABASE_URL` or `TEST_DATABASE_URL` points at a database whose URL contains `hislite_test` (CI default). They truncate that database between cases.
