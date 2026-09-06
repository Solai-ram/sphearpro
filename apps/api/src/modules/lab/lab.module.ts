import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [LabController],
  providers: [LabService],
  exports: [LabService],
})
export class LabModule {}
