# Therapy Workflow Specification

**Phase 0 Deliverable #6** — Covers §16, §26, §43 rules

---

## 1. Core Entities & Relationships

```
Patient
  │
  └── TherapyCase (1:N)
        │
        ├── Assessment (free text)
        ├── Goals (JSON: [{text, targetDate, status}])
        └── TherapyPackage assignment (via PatientPackage)
              │
              └── PatientPackage (1:1 per assignment)
                    ├── totalSessions (snapshot)
                    ├── usedSessions (counter)
                    ├── remainingSessions (computed = total - used)
                    ├── expiryDate (purchaseDate + validityDays)
                    │
                    └── TherapySession generation (1:N)
                          │
                          ├── scheduledAt (DateTime)
                          ├── status (SCHEDULED/COMPLETED/CANCELLED/RESCHEDULED/NO_SHOW)
                          ├── Attendance (1:1)
                          │     └── status (PRESENT/ABSENT/CANCELLED/RESCHEDULED/LATE)
                          ├── TherapyNote (1:N) — SOAP structure
                          └── Billing (via InvoiceItem)
                                └── billed separately if NO PatientPackage linked
```

---

## 2. Therapy Package Definition

| Field | Type | Notes |
|-------|------|-------|
| name | String | e.g. "Speech Therapy" |
| totalSessions | Int | e.g. 20 |
| frequency | Enum | WEEKLY, TWICE_WEEKLY, THREE_TIMES_WEEKLY, DAILY, EVERY_TWO_WEEKS, MONTHLY, CUSTOM |
| price | Decimal(10,2) | e.g. 15000.00 |
| validityDays | Int? | Optional expiry from purchase date |
| therapyTypeId | FK | Links to therapy_types |

**Custom frequency** → stores cron-like pattern in JSON: `{ days: [1,3,5], time: "10:00" }` (Mon/Wed/Fri at 10am).

---

## 3. Session Generation Algorithm (US-THER-004)

**Input:** `PatientPackage` (totalSessions, frequency, purchasedAt)  
**Output:** Array of `TherapySession` with `scheduledAt`, `status=SCHEDULED`

```typescript
function generateSessions(pkg: PatientPackage): TherapySession[] {
  const sessions: TherapySession[] = [];
  let current = pkg.purchasedAt;
  let count = 0;
  
  while (count < pkg.totalSessions) {
    // Skip past dates
    if (current <= new Date()) { 
      current = addFrequency(current, pkg.frequency); 
      continue; 
    }
    
    sessions.push({
      therapyCaseId: pkg.therapyCaseId,
      patientPackageId: pkg.id,
      therapistId: pkg.therapyCase.therapistId,
      scheduledAt: current,
      status: 'SCHEDULED',
    });
    
    count++;
    current = addFrequency(current, pkg.frequency);
  }
  
  return sessions;
}

function addFrequency(date: Date, freq: SessionFrequency): Date {
  switch (freq) {
    case 'WEEKLY': return addDays(date, 7);
    case 'TWICE_WEEKLY': return addDays(date, 3.5); // alternate
    case 'THREE_TIMES_WEEKLY': return addDays(date, 2.33);
    case 'DAILY': return addDays(date, 1);
    case 'EVERY_TWO_WEEKS': return addDays(date, 14);
    case 'MONTHLY': return addMonths(date, 1);
    case 'CUSTOM': return addCustom(date, pkg.customPattern);
  }
}
```

**Edge cases:**
- Sessions generated only for **future** dates (past dates skipped)
- If `expiryDate` reached before all sessions generated → stop
- Rescheduling a session does **not** affect `usedSessions` or remaining count
- Cancellation → status `CANCELLED`, session retained for audit

---

## 4. Attendance & Billing Independence (Rules §774–776)

| Scenario | Attendance | Billing |
|----------|------------|---------|
| Package patient attends | `usedSessions++` | No separate bill (covered by package) |
| Package patient no-show | `usedSessions++` (if policy) | No separate bill |
| Non-package patient attends | No package link | Invoice item `THERAPY_SESSION` created |
| Non-package patient no-show | — | Optional: charge no-show fee |

**Key rule:** `TherapySession.patientPackageId` = NULL → session billed individually.  
`usedSessions` increments **only on PRESENT** (configurable per clinic policy).

---

## 5. Rescheduling (US-THER-005)

- `TherapySession.status = RESCHEDULED`
- New `TherapySession` created with new `scheduledAt`
- Original session retained with `status=RESCHEDULED`
- `usedSessions` **unchanged**
- Attendance moves to new session

---

## 6. Therapist Notes (US-THER-007/008)

**SOAP Structure (all optional, at least one required):**
```json
{
  "subjective": "Patient reports...",
  "objective": "Observed...",
  "activities": "Performed...",
  "observations": "Noted...",
  "progress": "Improving...",
  "challenges": "Difficulty with...",
  "nextPlan": "Continue..."
}
```

**Voice Note Pipeline (US-THER-008):**
```
Audio (browser MediaRecorder)
  �� POST /api/v1/ai/transcribe (multipart)
Sarvam AI → transcript
  �� POST /api/v1/ai/note-draft { transcript }
OpenRouter LLM → structured SOAP draft (isAiDraft=true)
  �� Therapist reviews in UI
PATCH /api/v1/therapy/notes/:id { ..., aiReviewed: true }
```

---

## 7. AI Therapy Summary (US-THER-009)

**Trigger:** Therapist clicks "Generate Summary" on case  
**Input:** All prior `TherapyNote` + `TherapyProgress` + `TherapyAttendance` for case  
**Output:** `TherapyAiSummary` with:
- Previous goals
- Progress
- Important observations
- Recent sessions
- Repeated issues
- Current goals
- Areas requiring attention

**Safety gate (§30, §698):**
1. AI writes to `TherapyAiSummary` with `isReviewed=false`
2. Therapist **must** open, review, click "Approve"
3. On approve: `isReviewed=true`, `reviewedBy`, `reviewedAt`
4. Only reviewed summaries appear in clinical timeline

---

## 8. State Machine: TherapySession

```
SCHEDULED
  ├── (attendance=PRESENT) ──→ COMPLETED
  ├── (attendance=ABSENT) ───→ NO_SHOW
  ├── (attendance=CANCELLED) → CANCELLED
  ├── (reschedule) ─────────→ RESCHEDULED → new SCHEDULED
  └── (no action, past) ────→ NO_SHOW (batch job)
```

---

## 9. Events Emitted (for billing, communication, audit)

| Event | Payload | Consumers |
|-------|---------|-----------|
| `therapy.session.scheduled` | {sessionId, patientId, scheduledAt} | Communication (reminder), Billing (if no package) |
| `therapy.attendance.marked` | {sessionId, status, markedAt} | Billing (increment usedSessions), Dashboard |
| `therapy.note.created` | {sessionId, noteId, isAiDraft} | Audit, AI (for future summaries) |
| `therapy.package.assigned` | {patientPackageId, totalSessions} | Billing (invoice for package), Session generation |
| `therapy.ai.summary.generated` | {summaryId, therapyCaseId} | Audit, Therapist notification |
| `therapy.ai.summary.reviewed` | {summaryId, reviewedBy} | Audit, Timeline |

---

## 10. Validation Rules (Service Layer)

1. **Session generation:** `totalSessions > 0`, `frequency` valid, `expiryDate` > `purchasedAt`
2. **Attendance:** One `TherapyAttendance` per session (unique constraint on `sessionId`)
3. **Package assignment:** Patient can have multiple active packages (different types)
4. **Note edit:** `isAiDraft` can only be set to `false` by therapist (not AI)
5. **Summary review:** Only therapist on case or admin can review

---

## 11. Test Cases (Integration)

| Scenario | Expected |
|----------|----------|
| Assign 20-session weekly package → generate sessions | 20 future weekly sessions created |
| Assign package with expiry 30 days, 20 sessions | Only sessions before expiry generated |
| Mark attendance PRESENT on packaged session | `usedSessions++`, no invoice item |
| Mark attendance PRESENT on non-packaged session | Invoice item `THERAPY_SESSION` created |
| Reschedule session | Original=RESCHEDULED, new=SCHEDULED, usedSessions unchanged |
| Generate AI summary → therapist approves | `isReviewed=true`, appears in timeline |
| Voice note → transcript → draft → approve | `TherapyNote` with `aiReviewed=true` |