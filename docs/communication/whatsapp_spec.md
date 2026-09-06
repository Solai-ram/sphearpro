# WhatsApp Event/Message Specification

**Phase 0 Deliverable #9** — Covers §19, §28, §1146–1168

---

## 1. Architecture Recap

```
Business Event (e.g. appointment.booked)
    │
    ��
NestJS EventEmitter (domain event)
    │
    ��
BullMQ Queue: "whatsapp"
    │
    ��
WhatsApp Worker (consumer)
    │
    ��
WhatsApp Business API Provider (Gupshup / Twilio / Meta direct)
    │
    ��
Delivery Status Webhook
    │
    ��
communication_messages.status update
```

---

## 2. Business Events → WhatsApp Templates

| Business Event | Trigger | Template | Timing |
|----------------|---------|----------|--------|
| `appointment.booked` | Appointment created | `appointment_confirmation` | Immediate |
| `appointment.reminder_24h` | Scheduler (24h before) | `appointment_reminder` | T-24h |
| `appointment.reminder_1h` | Scheduler (1h before) | `appointment_reminder` | T-1h |
| `therapy.session.scheduled` | Session generated | `therapy_session_confirmation` | Immediate |
| `therapy.session.reminder_day` | Scheduler (day before) | `therapy_reminder` | T-1d |
| `therapy.session.reminder_morning` | Scheduler (morning of) | `therapy_reminder` | T-2h |
| `invoice.created` | Invoice generated | `invoice_notification` | Immediate |
| `payment.received` | Payment recorded | `payment_receipt` | Immediate |
| `patient.registered` | New patient | `welcome_message` | Immediate |

---

## 3. BullMQ Job Payloads

### 3.1 Queue: `whatsapp`

```typescript
interface WhatsAppJob {
  type: 'send_template' | 'send_media';
  to: string;                    // Phone in E.164: "+91XXXXXXXXXX"
  templateName: string;          // Matches message_templates.name
  language: string;              // "en", "hi", etc.
  parameters: Record<string, string>; // Template variables
  referenceType: string;         // "appointment" | "invoice" | "payment" | "patient"
  referenceId: string;           // Entity ID
  priority: number;              // 1=high (receipts), 5=normal, 10=low (reminders)
  idempotencyKey: string;        // Prevents duplicate sends
}
```

### 3.2 Job Examples

**Appointment Reminder (24h):**
```json
{
  "type": "send_template",
  "to": "+919876543210",
  "templateName": "appointment_reminder_24h",
  "language": "en",
  "parameters": {
    "patientName": "Rajesh Kumar",
    "date": "2026-08-15",
    "time": "10:30 AM",
    "doctorName": "Dr. Sharma",
    "clinicName": "City Clinic"
  },
  "referenceType": "appointment",
  "referenceId": "appt_cuid123",
  "priority": 5,
  "idempotencyKey": "appt_cuid123_reminder_24h"
}
```

**Payment Receipt:**
```json
{
  "type": "send_template",
  "to": "+919876543210",
  "templateName": "payment_receipt",
  "language": "en",
  "parameters": {
    "patientName": "Rajesh Kumar",
    "amount": "��1,500.00",
    "invoiceNumber": "INV-2026-000421",
    "date": "2026-08-14",
    "paymentMethod": "UPI"
  },
  "referenceType": "payment",
  "referenceId": "pay_cuid456",
  "priority": 1,
  "idempotencyKey": "pay_cuid456_receipt"
}
```

---

## 4. WhatsApp Template Definitions (Meta-approved format)

| Template Name | Language | Category | Body |
|---------------|----------|----------|------|
| `appointment_confirmation` | en/hi | UTILITY | Hi {{1}}, your appointment with {{2}} is confirmed for {{3}} at {{4}}. Clinic: {{5}} |
| `appointment_reminder_24h` | en/hi | UTILITY | Reminder: You have an appointment tomorrow with {{1}} at {{2}} on {{3}}. Clinic: {{4}} |
| `appointment_reminder_1h` | en/hi | UTILITY | Your appointment with {{1}} is in 1 hour at {{2}}. Please arrive 10 mins early. Clinic: {{3}} |
| `therapy_session_confirmation` | en/hi | UTILITY | Your therapy session {{1}} is scheduled for {{2}} at {{3}} with {{4}}. |
| `therapy_reminder` | en/hi | UTILITY | Reminder: Therapy session {{1}} with {{2}} is {{3}}. |
| `invoice_notification` | en/hi | UTILITY | Invoice {{1}} for ₹{{2}} generated on {{3}}. View: {{4}} |
| `payment_receipt` | en/hi | UTILITY | Payment of ₹{{1}} received for Invoice {{2}} on {{3}}. Method: {{4}}. |
| `welcome_message` | en/hi | MARKETING | Welcome to {{1}}, {{2}}! Your patient ID is {{3}}. |

**Variable mapping (1-indexed per Meta):**
- `{{1}}` → `parameters.patientName` or `parameters.doctorName`
- `{{2}}` → `parameters.date` or `parameters.time` etc.

---

## 5. WhatsApp Worker Implementation

```typescript
// apps/api/src/modules/communication/workers/whatsapp.worker.ts
@Processor('whatsapp')
export class WhatsAppWorker {
  @Process('send_template')
  async handleSendTemplate(job: Job<WhatsAppJob>) {
    const { to, templateName, language, parameters, idempotencyKey } = job.data;
    
    // Idempotency check
    const existing = await this.msgRepo.findOne({ where: { idempotencyKey } });
    if (existing) return { status: 'duplicate', messageId: existing.providerMsgId };
    
    // Build provider payload (example: Gupshup)
    const payload = this.buildTemplatePayload(to, templateName, language, parameters);
    
    // Send via provider
    const response = await this.provider.sendTemplate(payload);
    
    // Save message record
    const message = await this.msgRepo.create({
      patientId: await this.getPatientId(job.data.referenceType, job.data.referenceId),
      type: job.data.referenceType.toUpperCase() as MessageType,
      channel: Channel.WHATSAPP,
      to,
      content: JSON.stringify(parameters),
      status: MessageStatus.SENT,
      providerMsgId: response.messageId,
      sentAt: new Date(),
      idempotencyKey,
      referenceType: job.data.referenceType,
      referenceId: job.data.referenceId,
    });
    
    return { status: 'sent', messageId: message.id };
  }
  
  @Process('send_media')
  async handleSendMedia(job: Job<WhatsAppMediaJob>) {
    // For PDF invoices, reports
  }
}
```

---

## 6. Delivery Status Webhook

### 6.1 Endpoint
```
POST /api/v1/communication/webhook/whatsapp
Headers: X-WhatsApp-Signature (HMAC-SHA256)
```

### 6.2 Payload (Provider-agnostic normalized)

```typescript
interface WhatsAppStatusWebhook {
  messageId: string;           // Provider message ID
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;           // ISO 8601
  recipient: string;           // Phone E.164
  errorCode?: string;          // If failed
  errorMessage?: string;
}
```

### 6.3 Handler

```typescript
@Post('webhook/whatsapp')
async handleWebhook(@Body() payload: WhatsAppStatusWebhook, @Headers() headers) {
  // 1. Verify HMAC signature
  if (!this.verifySignature(payload, headers['x-whatsapp-signature'])) {
    throw new UnauthorizedException('Invalid signature');
  }
  
  // 2. Find message by providerMsgId
  const message = await this.msgRepo.findOne({ 
    where: { providerMsgId: payload.messageId } 
  });
  if (!message) return { status: 'not_found' };
  
  // 3. Update status
  const newStatus = this.mapStatus(payload.status);
  await this.msgRepo.update(message.id, {
    status: newStatus,
    deliveredAt: payload.status === 'delivered' ? new Date(payload.timestamp) : undefined,
    readAt: payload.status === 'read' ? new Date(payload.timestamp) : undefined,
    failedAt: payload.status === 'failed' ? new Date(payload.timestamp) : undefined,
    failureReason: payload.errorMessage,
  });
  
  // 4. Emit event for dashboard/analytics
  this.eventEmitter.emit('whatsapp.status.updated', { messageId: message.id, status: newStatus });
  
  return { status: 'ok' };
}
```

---

## 7. Message Status Flow

```
QUEUED (job created)
    │
    ��
SENT (provider accepted)
    │
    ├──→ DELIVERED (on device)
    │       │
    │       └──→ READ (user opened)
    │
    └──→ FAILED (provider error)
            │
            └──→ Retry (BullMQ backoff: 5m, 15m, 1h, 6h) → max 3 retries
```

---

## 8. Template Management (Admin UI)

| Action | Endpoint | Permission |
|--------|----------|------------|
| List templates | GET /templates | communication.view |
| Create template | POST /templates | communication.send |
| Update template | PATCH /templates/:id | communication.send |
| Sync to provider | POST /templates/:id/sync | communication.send |

**Sync flow:** Admin edits template in UI → clicks "Sync" → calls provider API to update template → updates local `message_templates` record with provider template ID.

---

## 9. Configuration (Environment)

```env
# Provider (choose one)
WHATSAPP_PROVIDER=gupshup|twilio|meta
WHATSAPP_API_KEY=xxx
WHATSAPP_API_SECRET=xxx
WHATSAPP_WEBHOOK_SECRET=xxx
WHATSAPP_SENDER_ID=xxx        # Gupshup: source number
WHATSAPP_TEMPLATE_NAMESPACE=xxx # Meta: namespace

# Queue
REDIS_URL=redis://localhost:6379
BULLMQ_WHATSAPP_CONCURRENCY=10
```

---

## 10. Testing Requirements

| Test | Criteria |
|------|----------|
| Unit: payload building | Correct template vars for each event type |
| Unit: idempotency | Duplicate job with same key returns existing message |
| Integration: webhook | Valid signature → status updated; invalid → 401 |
| Integration: retry | Failed job retries with exponential backoff |
| E2E: appointment reminder | Booking → 24h job → sent → webhook delivered → status=DELIVERED |
| Load: 1000 concurrent jobs | Queue processes within SLA (<5 min) |

---

## 11. Monitoring & Alerts

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Failed sends / hour | > 50 | PagerDuty |
| Webhook failures | > 10% | Slack |
| Queue depth | > 5000 | Slack |
| Delivery rate | < 95% | Daily report |

---

## 12. Compliance

- **Opt-in:** Patient consent recorded at registration (phone verified)
- **Opt-out:** STOP keyword handling → add to suppression list
- **Retention:** Message content retained 90 days; metadata 1 year
- **PII:** Phone numbers encrypted at rest (column-level encryption)