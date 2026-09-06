import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuditModule } from '../audit/audit.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [AuditModule, CommunicationModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
