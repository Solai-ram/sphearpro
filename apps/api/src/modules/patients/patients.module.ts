import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [AuditModule, DocumentsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}