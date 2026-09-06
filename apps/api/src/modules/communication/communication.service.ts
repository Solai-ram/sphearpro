import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';

type MessageType = 'APPOINTMENT_REMINDER' | 'THERAPY_REMINDER' | 'PAYMENT_RECEIPT' | 'INVOICE' | 'GENERIC';

@Injectable()
export class CommunicationService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    @InjectQueue('whatsapp') private whatsappQueue: Queue,
    private auditService: AuditService,
  ) {}

  productName() {
    return process.env.PRODUCT_NAME || process.env.CLINIC_NAME || 'SPHEAR';
  }

  async queueAppointmentConfirmation(appointmentId: string) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment) return null;
    const when = this.formatWhen(appointment.appointmentAt);
    return this.enqueue({
      clinicId: appointment.clinicId,
      patientId: appointment.patient.id,
      phone: appointment.patient.phone,
      type: 'GENERIC',
      templateName: 'appointment_confirmation',
      appointmentId,
      referenceType: 'appointment',
      referenceId: appointmentId,
      jobId: `appt-confirm-${appointmentId}`,
      vars: {
        patientName: appointment.patient.name,
        providerName: appointment.provider?.name || 'your clinician',
        when,
        clinicName: this.productName(),
      },
    });
  }

  async queueAppointmentReminder(appointmentId: string, reminderOffsetHours: number) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment) return null;
    const sendAt = new Date(appointment.appointmentAt);
    sendAt.setHours(sendAt.getHours() - reminderOffsetHours);
    const when = this.formatWhen(appointment.appointmentAt);
    const timing = reminderOffsetHours === 24 ? 'tomorrow' : 'in 1 hour';
    return this.enqueue({
      clinicId: appointment.clinicId,
      patientId: appointment.patient.id,
      phone: appointment.patient.phone,
      type: 'APPOINTMENT_REMINDER',
      templateName: reminderOffsetHours === 24 ? 'appointment_reminder_24h' : 'appointment_reminder_1h',
      appointmentId,
      referenceType: 'appointment',
      referenceId: appointmentId,
      jobId: `reminder-${appointmentId}-${reminderOffsetHours}h`,
      delayMs: Math.max(0, sendAt.getTime() - Date.now()),
      vars: {
        patientName: appointment.patient.name,
        providerName: appointment.provider?.name || 'your clinician',
        when,
        timing,
        clinicName: this.productName(),
      },
    });
  }

  async queueTherapySessions(sessionIds: string[]) {
    for (const sessionId of sessionIds) {
      try {
        await this.queueTherapySession(sessionId);
      } catch (error) {
        console.error(`Failed to queue therapy WhatsApp for session ${sessionId}:`, error);
      }
    }
  }

  async queueTherapySession(sessionId: string) {
    const session = await this.prisma.therapySession.findUnique({
      where: { id: sessionId },
      include: {
        therapyCase: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            therapist: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Therapy session not found');
    const patient = session.therapyCase.patient;
    const when = this.formatWhen(session.scheduledAt);

    await this.enqueue({
      clinicId: session.clinicId,
      patientId: patient.id,
      phone: patient.phone,
      type: 'GENERIC',
      templateName: 'therapy_session_confirmation',
      referenceType: 'therapy_session',
      referenceId: sessionId,
      jobId: `therapy-confirm-${sessionId}`,
      vars: {
        patientName: patient.name,
        title: session.therapyCase.title,
        when,
        therapistName: session.therapyCase.therapist?.name || 'your therapist',
        clinicName: this.productName(),
      },
    });

    const dayBefore = new Date(session.scheduledAt);
    dayBefore.setDate(dayBefore.getDate() - 1);
    await this.enqueue({
      clinicId: session.clinicId,
      patientId: patient.id,
      phone: patient.phone,
      type: 'THERAPY_REMINDER',
      templateName: 'therapy_reminder',
      referenceType: 'therapy_session',
      referenceId: sessionId,
      jobId: `therapy-reminder-day-${sessionId}`,
      delayMs: Math.max(0, dayBefore.getTime() - Date.now()),
      vars: {
        patientName: patient.name,
        title: session.therapyCase.title,
        when,
        timing: 'tomorrow',
        therapistName: session.therapyCase.therapist?.name || 'your therapist',
      },
    });

    const twoHours = new Date(session.scheduledAt);
    twoHours.setHours(twoHours.getHours() - 2);
    return this.enqueue({
      clinicId: session.clinicId,
      patientId: patient.id,
      phone: patient.phone,
      type: 'THERAPY_REMINDER',
      templateName: 'therapy_reminder',
      referenceType: 'therapy_session',
      referenceId: sessionId,
      jobId: `therapy-reminder-2h-${sessionId}`,
      delayMs: Math.max(0, twoHours.getTime() - Date.now()),
      vars: {
        patientName: patient.name,
        title: session.therapyCase.title,
        when,
        timing: 'in 2 hours',
        therapistName: session.therapyCase.therapist?.name || 'your therapist',
      },
    });
  }

  async queueInvoiceNotification(invoiceId: string, options?: { force?: boolean }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.enqueue({
      clinicId: invoice.clinicId,
      patientId: invoice.patient.id,
      phone: invoice.patient.phone,
      type: 'INVOICE',
      templateName: 'invoice_notification',
      invoiceId,
      referenceType: 'invoice',
      referenceId: invoiceId,
      jobId: options?.force ? `invoice-${invoiceId}-${Date.now()}` : `invoice-${invoiceId}`,
      vars: {
        patientName: invoice.patient.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.grandTotal).toFixed(2),
        date: new Date(invoice.issueDate).toLocaleDateString('en-IN'),
        clinicName: this.productName(),
      },
    });
  }

  async queuePaymentReceipt(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, grandTotal: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.enqueue({
      clinicId: payment.clinicId,
      patientId: payment.patient.id,
      phone: payment.patient.phone,
      type: 'PAYMENT_RECEIPT',
      templateName: 'payment_receipt',
      invoiceId: payment.invoiceId,
      referenceType: 'payment',
      referenceId: paymentId,
      jobId: `receipt-${paymentId}`,
      vars: {
        patientName: payment.patient.name,
        amount: Number(payment.amount).toFixed(2),
        invoiceNumber: payment.invoice?.invoiceNumber || '',
        method: payment.method,
        date: new Date(payment.paidAt).toLocaleDateString('en-IN'),
        clinicName: this.productName(),
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    type?: string;
  }) {
    const { page = 1, limit = 50, status, patientId, type } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.communicationMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true } },
          appointment: { select: { id: true, appointmentAt: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.communicationMessage.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const message = await this.prisma.communicationMessage.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true } },
        appointment: { select: { id: true, appointmentAt: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });
    if (!message) throw new NotFoundException('Communication message not found');
    return message;
  }

  async resend(id: string) {
    const message = await this.prisma.communicationMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Communication message not found');
    await this.whatsappQueue.add('send-manual', { messageId: message.id }, {
      jobId: `manual-${id}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    await this.prisma.communicationMessage.update({ where: { id }, data: { status: 'QUEUED', failureReason: null } });
    return { message: 'Message queued for resend' };
  }

  async listTemplates() {
    return this.prisma.messageTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async upsertTemplate(data: { name: string; type: MessageType; language?: string; body: string; isActive?: boolean }, actorId?: string) {
    const template = await this.prisma.messageTemplate.upsert({
      where: { name: data.name },
      update: { type: data.type, language: data.language || 'en', body: data.body, isActive: data.isActive ?? true },
      create: { name: data.name, type: data.type, language: data.language || 'en', body: data.body, isActive: data.isActive ?? true },
    });
    await this.auditService.log({
      actorId,
      actorType: 'user',
      action: 'MESSAGE_TEMPLATE_SAVED',
      entityType: 'MessageTemplate',
      entityId: template.id,
      result: 'SUCCESS',
      metadata: { name: template.name },
    });
    return template;
  }

  verifyWebhookChallenge(mode?: string, token?: string, challenge?: string) {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || token !== expected) {
      throw new UnauthorizedException('Invalid webhook verify token');
    }
    return challenge || '';
  }

  async handleWebhook(payload: any, signature?: string) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === 'production';
    // Fail closed in production; in development allow unsigned only when secret unset
    if (isProd || secret) {
      if (!secret) {
        throw new UnauthorizedException('Webhook secret not configured');
      }
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      const expected =
        'sha256=' + createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const statuses: Array<{ id?: string; status?: string; timestamp?: string; errors?: any[] }> = [];
    if (payload?.messageId && payload?.status) {
      statuses.push({ id: payload.messageId, status: payload.status, timestamp: payload.timestamp, errors: payload.errorMessage ? [{ message: payload.errorMessage }] : undefined });
    }
    for (const entry of payload?.entry || []) {
      for (const change of entry.changes || []) {
        for (const status of change.value?.statuses || []) statuses.push(status);
      }
    }

    const updated: string[] = [];
    for (const item of statuses) {
      if (!item.id) continue;
      const message = await this.prisma.communicationMessage.findFirst({ where: { providerMsgId: item.id } });
      if (!message) continue;
      const mapped = this.mapProviderStatus(item.status);
      const at = item.timestamp ? new Date(Number(item.timestamp) * 1000) : new Date();
      await this.prisma.communicationMessage.update({
        where: { id: message.id },
        data: {
          status: mapped,
          deliveredAt: mapped === 'DELIVERED' || mapped === 'READ' ? at : message.deliveredAt,
          readAt: mapped === 'READ' ? at : message.readAt,
          failedAt: mapped === 'FAILED' ? at : message.failedAt,
          failureReason: mapped === 'FAILED' ? (item.errors?.[0]?.message || 'Provider failure') : message.failureReason,
        },
      });
      updated.push(message.id);
    }
    return { status: 'ok', updated: updated.length };
  }

  private mapProviderStatus(status?: string): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' {
    switch ((status || '').toLowerCase()) {
      case 'delivered': return 'DELIVERED';
      case 'read': return 'READ';
      case 'failed': return 'FAILED';
      default: return 'SENT';
    }
  }

  private async loadAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        provider: { select: { id: true, name: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private formatWhen(value: Date | string) {
    return new Date(value).toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private applyTemplate(body: string, vars: Record<string, string>) {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }

  private defaultBody(templateName: string, vars: Record<string, string>) {
    const map: Record<string, string> = {
      appointment_confirmation: 'Hi {{patientName}}, your appointment with {{providerName}} is confirmed for {{when}}.',
      appointment_reminder_24h: 'Reminder: {{patientName}}, you have an appointment {{timing}} with {{providerName}} at {{when}}.',
      appointment_reminder_1h: 'Your appointment with {{providerName}} is {{timing}} at {{when}}. Please arrive 10 mins early.',
      therapy_session_confirmation: 'Hi {{patientName}}, your therapy session "{{title}}" is scheduled for {{when}} with {{therapistName}}.',
      therapy_reminder: 'Reminder: Therapy session "{{title}}" with {{therapistName}} is {{timing}} ({{when}}).',
      invoice_notification: 'Hi {{patientName}}, invoice {{invoiceNumber}} for ₹{{amount}} was generated on {{date}}.',
      payment_receipt: 'Hi {{patientName}}, payment of ₹{{amount}} received for invoice {{invoiceNumber}} on {{date}}. Method: {{method}}.',
    };
    return this.applyTemplate(map[templateName] || 'Hi {{patientName}}.', vars);
  }

  private async enqueue(input: {
    clinicId: string;
    patientId: string;
    phone?: string | null;
    type: MessageType;
    templateName: string;
    appointmentId?: string;
    invoiceId?: string;
    referenceType: string;
    referenceId: string;
    jobId: string;
    delayMs?: number;
    vars: Record<string, string>;
  }) {
    if (!input.phone) {
      console.warn(`Skipping WhatsApp ${input.jobId}: patient has no phone`);
      return null;
    }

    const existingJob = await this.whatsappQueue.getJob(input.jobId);
    if (existingJob) return { skipped: true, jobId: input.jobId };

    const template = await this.prisma.messageTemplate.findUnique({ where: { clinicId_name: { clinicId: input.clinicId, name: input.templateName } } });
    const content = template?.body
      ? this.applyTemplate(template.body, input.vars)
      : this.defaultBody(input.templateName, input.vars);

    const message = await this.prisma.communicationMessage.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        templateId: template?.id,
        appointmentId: input.appointmentId,
        invoiceId: input.invoiceId,
        type: input.type,
        channel: 'WHATSAPP',
        to: input.phone,
        content,
        status: 'QUEUED',
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });

    await this.whatsappQueue.add(
      'send-message',
      { messageId: message.id },
      {
        jobId: input.jobId,
        delay: input.delayMs || 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    await this.prisma.communicationEvent.create({
      data: {
        clinicId: input.clinicId,
        eventType: input.templateName.toUpperCase(),
        payload: { jobId: input.jobId, messageId: message.id, referenceId: input.referenceId },
      },
    });

    return message;
  }
}
