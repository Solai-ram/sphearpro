import { Module } from '@nestjs/common';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuditModule, BillingModule],
  controllers: [ClinicalController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}