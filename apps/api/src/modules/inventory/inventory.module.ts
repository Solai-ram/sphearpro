import { Module, forwardRef } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuditModule, forwardRef(() => BillingModule)],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
