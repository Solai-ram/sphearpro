# AI Gateway Specification

**Phase 0 Deliverable #8** — Covers §23, §29, §30, §1180–1225

---

## 1. Architecture Overview

```
��─────────────��     ��──────────────��     ��─────────────────��
│   React     │────��│   NestJS     │────��│   AI Gateway    │
│  (Client)   │     │  (Backend)   │     │  (Module)       │
��─────────────��     └──────────────��     └────────��────────��
                                                  │
                        ��─────────────────────────��─────────────────────────��
                        ��                         ��                         ��
                 ��─────────────��           ��─────────────��           ��─────────────��
                 │  OpenRouter │           │  Sarvam AI  │           │  (Future)   │
                 │   (LLM)     │           │   (STT)     │           │  Providers  │
                 └─────────────��           └─────────────��           └─────────────��
```

**Key principle (§30, §1216):** `AI → Draft → Human Review → Final Clinical Record` — **never** AI → direct DB write.

---

## 2. Gateway Interface (NestJS Module)

```typescript
// apps/api/src/modules/ai/ai.gateway.ts
interface AiGateway {
  // Therapy summary (LLM)
  generateTherapySummary(input: TherapySummaryInput): Promise<AiDraftOutput>;
  
  // Voice transcription (STT)
  transcribeAudio(audio: Buffer, mimeType: string): Promise<TranscriptionOutput>;
  
  // Note draft from transcript (LLM)
  draftNoteFromTranscript(input: NoteDraftInput): Promise<AiDraftOutput>;
  
  // Progress summary (LLM)
  generateProgressSummary(input: ProgressSummaryInput): Promise<AiDraftOutput>;
}
```

**Provider abstraction:** Each method delegates to registered provider adapter. Adding new provider = implement `AiProviderAdapter` interface.

---

## 3. Provider Adapters

### 3.1 OpenRouter Adapter (LLM)

```typescript
interface OpenRouterAdapter {
  chatCompletion(request: {
    model: string;           // e.g. "anthropic/claude-3.5-sonnet"
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<ChatCompletionResponse>;
  
  listModels(): Promise<Model[]>;
}
```

**Models used:**
- Therapy summary: `anthropic/claude-3.5-sonnet` (structured JSON output)
- Note draft: `anthropic/claude-3.5-sonnet` (SOAP-structured JSON)
- Progress summary: `anthropic/claude-3.5-sonnet`

**Configuration (env/secret manager):**
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (default: `https://openrouter.ai/api/v1`)

### 3.2 Sarvam AI Adapter (STT)

```typescript
interface SarvamAdapter {
  transcribe(request: {
    audio: Buffer;
    mimeType: 'audio/wav' | 'audio/mp3' | 'audio/webm';
    language?: string;       // 'hi-IN', 'en-IN', etc.
    model?: string;          // 'saarika:v1' etc.
  }): Promise<TranscriptionResponse>;
}
```

**Configuration (env/secret manager):**
- `SARVAM_API_KEY`
- `SARVAM_BASE_URL` (default: `https://api.sarvam.ai`)

---

## 4. Request/Response Types

### 4.1 Therapy Summary Input/Output

```typescript
interface TherapySummaryInput {
  therapyCaseId: string;
  includeNotes: TherapyNote[];      // All prior notes
  includeAttendance: TherapyAttendance[];
  includeProgress: TherapyProgress[];
  maxTokens?: number;
}

interface TherapySummaryOutput {
  previousGoals: string[];
  progress: string;
  importantObservations: string[];
  recentSessions: SessionSummary[];
  repeatedIssues: string[];
  currentGoals: string[];
  attentionAreas: string[];
}
```

**Prompt template (stored in DB/config):**
```
You are a clinical assistant. Summarize the therapy history for a therapist.
Patient context: {therapyCase.title}, {patient.name}, {patient.age}
Notes: {formatted notes}
Attendance: {attendance summary}
Progress metrics: {progress data}

Output JSON with fields: previousGoals, progress, importantObservations, 
recentSessions, repeatedIssues, currentGoals, attentionAreas.
```

### 4.2 Transcription Output

```typescript
interface TranscriptionOutput {
  transcript: string;
  language: string;
  confidence: number;     // 0-1
  durationSeconds: number;
}
```

### 4.3 Note Draft Input/Output

```typescript
interface NoteDraftInput {
  transcript: string;
  sessionContext: {
    therapyType: string;
    patientAge: number;
    priorGoals: string[];
  };
}

interface NoteDraftOutput {
  subjective: string;
  objective: string;
  activities: string;
  observations: string;
  progress: string;
  challenges: string;
  nextPlan: string;
}
```

**Prompt template:**
```
Convert the following therapist transcript into a structured SOAP note.
Transcript: {transcript}
Context: {sessionContext}

Output JSON with SOAP fields. Use clinical terminology.
If unsure about a section, leave empty string.
```

---

## 5. Safety & Audit (Non-Negotiable)

### 5.1 AI Output Never Written Directly to Clinical Tables

| AI Output | Stored In | Human Gate |
|-----------|-----------|------------|
| Therapy summary | `therapy_ai_summaries` (isReviewed=false) | Therapist clicks "Approve" → `isReviewed=true` |
| Transcript | `ai_outputs` (contentType=transcript) | Therapist reviews → copies to note |
| Note draft | `ai_outputs` (contentType=note_draft) | Therapist edits → saves as `therapy_notes` (aiReviewed=true) |

**Enforcement:** Gateway returns drafts only. No DB write permission for AI module on clinical tables.

### 5.2 Audit Logging

Every AI request creates `ai_requests` + `ai_outputs`:
- `ai_requests`: type, provider, model, promptTokens, inputRef, status
- `ai_outputs`: requestId, contentType, content, confidence, isReviewed
- `ai_usage`: provider, model, tokens, costUsd (for billing dashboard)

### 5.3 Rate Limiting & Cost Control

| Limit | Value |
|-------|-------|
| Requests/min (per user) | 20 |
| Max tokens/request | 4000 |
| Daily cost alert | $50 (configurable) |
| Auto-fail if provider error > 5/min | Circuit breaker |

---

## 6. Provider Config Management

Stored in `ai_provider_configs` table (no secrets):
```json
{
  "provider": "openrouter",
  "isEnabled": true,
  "apiBaseUrl": "https://openrouter.ai/api/v1",
  "defaultModel": "anthropic/claude-3.5-sonnet",
  "settings": {
    "timeoutMs": 30000,
    "retryAttempts": 2
  }
}
```

**Secrets:** `OPENROUTER_API_KEY`, `SARVAM_API_KEY` — only in env/secret manager, never in DB or code.

---

## 7. API Endpoints (matching `/api/v1/ai`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /therapy-summary | Generate therapy history summary |
| POST | /transcribe | Upload audio → Sarvam STT |
| POST | /note-draft | Transcript → SOAP draft |
| POST | /progress-summary | Generate progress summary |
| GET | /usage | Usage stats (admin) |
| GET | /providers | List configured providers |

---

## 8. Error Handling

| Error | HTTP | Handling |
|-------|------|----------|
| Provider timeout | 504 | Retry once, then fail |
| Provider rate limit | 429 | Exponential backoff, queue in BullMQ |
| Invalid audio format | 400 | Validate mimeType before send |
| Provider auth failure | 500 | Alert admin, disable provider |
| JSON parse failure | 500 | Log raw response, return structured error |

---

## 9. Testing Requirements

| Test | Criteria |
|------|----------|
| Unit: prompt construction | Output matches expected JSON schema |
| Unit: response parsing | Handles malformed provider responses |
| Integration: full pipeline | Audio → transcript → draft → note save |
| Safety: no clinical writes | Verify AI module has no Prisma write access to clinical tables |
| Cost: usage tracking | `ai_usage` records created per request |

---

## 10. Future Provider Extensibility

Adding new provider:
1. Implement `AiProviderAdapter` interface
2. Register in `AiGatewayModule` providers array
3. Add config to `ai_provider_configs`
4. Update model routing logic in gateway methods

No changes to business modules (therapy, clinical) required.