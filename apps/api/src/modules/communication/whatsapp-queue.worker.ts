import { Injectable, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WhatsAppAdapter } from './whatsapp.adapter';

@Injectable()
export class WhatsAppQueueWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private whatsApp: WhatsAppAdapter,
  ) {}

  onModuleInit() {
    // WhatsApp communication is disabled in v1 — skip worker registration
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      console.log('WhatsApp worker skipped (WHATSAPP_ENABLED !== true)');
      return;
    }

    this.worker = new Worker(
      'whatsapp',
      async (job: Job) => this.processSend(job),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`WhatsApp job ${job.id} (${job.name}) completed`);
    });
    this.worker.on('failed', (job, err) => {
      console.error(`WhatsApp job ${job?.id} (${job?.name}) failed:`, err);
    });
    this.worker.on('error', (err) => {
      console.error('WhatsApp worker error:', err);
    });
  }

  onModuleDestroy() {
    if (this.worker) this.worker.close();
  }

  private async processSend(job: Job) {
    const { messageId } = job.data;
    const message = await this.prisma.communicationMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      console.warn(`WhatsApp message ${messageId} not found`);
      return;
    }

    await this.prisma.communicationMessage.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    try {
      const result = await this.whatsApp.sendText(message.to, message.content);
      await this.prisma.communicationMessage.update({
        where: { id: messageId },
        data: {
          providerMsgId: result.providerMsgId,
          status: result.mocked ? 'DELIVERED' : 'SENT',
          deliveredAt: result.mocked ? new Date() : undefined,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorType: 'system',
          patientId: message.patientId,
          action: result.mocked ? 'WHATSAPP_MOCK_DELIVERED' : 'WHATSAPP_SENT',
          entityType: 'CommunicationMessage',
          entityId: messageId,
          result: 'SUCCESS',
          metadata: { providerMsgId: result.providerMsgId, messageType: message.type, mocked: result.mocked },
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.communicationMessage.update({
        where: { id: messageId },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: reason },
      });
      await this.prisma.auditLog.create({
        data: {
          actorType: 'system',
          patientId: message.patientId,
          action: 'WHATSAPP_FAILED',
          entityType: 'CommunicationMessage',
          entityId: messageId,
          result: 'FAILURE',
          metadata: { messageType: message.type, error: reason },
        },
      });
      throw error;
    }
  }
}
