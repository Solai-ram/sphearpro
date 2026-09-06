import { Module, forwardRef } from '@nestjs/common';
import { TherapyController } from './therapy.controller';
import { TherapyService } from './therapy.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { AiModule } from '../ai/ai.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [AuditModule, forwardRef(() => BillingModule), AiModule, CommunicationModule],
  controllers: [TherapyController],
  providers: [TherapyService],
  exports: [TherapyService],
})
export class TherapyModule {}
