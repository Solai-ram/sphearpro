import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceJobsService, ATTENDANCE_JOBS_QUEUE } from './attendance-jobs.service';
import { AttendanceJobsProcessor } from './attendance-jobs.processor';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    BullModule.registerQueue({ name: ATTENDANCE_JOBS_QUEUE }),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceJobsService, AttendanceJobsProcessor],
  exports: [AttendanceService],
})
export class AttendanceModule {}
