import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { WhatsAppQueueWorker } from './whatsapp-queue.worker';
import { WhatsAppQueueService } from './whatsapp-queue.service';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'whatsapp' },
      { name: 'email' },
      { name: 'notifications' },
    ),
    AuditModule,
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService, WhatsAppQueueWorker, WhatsAppQueueService, WhatsAppAdapter],
  exports: [CommunicationService, WhatsAppQueueService],
})
export class CommunicationModule {}