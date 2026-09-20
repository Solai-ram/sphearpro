import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceService } from './attendance.service';

export const ATTENDANCE_JOBS_QUEUE = 'attendance-jobs';

export const ATT_JOB = {
  MARK_ABSENT: 'attendance-mark-absent',
} as const;

@Injectable()
export class AttendanceJobsService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceJobsService.name);

  constructor(
    @InjectQueue(ATTENDANCE_JOBS_QUEUE) private queue: Queue,
    private attendance: AttendanceService,
  ) {}

  async onModuleInit() {
    if (process.env.ATTENDANCE_JOBS_DISABLED === 'true') {
      this.logger.warn('Attendance scheduled jobs disabled (ATTENDANCE_JOBS_DISABLED=true)');
      return;
    }
    try {
      await this.queue.add(
        ATT_JOB.MARK_ABSENT,
        { scheduled: true },
        {
          jobId: `repeat:${ATT_JOB.MARK_ABSENT}`,
          repeat: { every: 60 * 60 * 1000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
      this.logger.log(`Scheduled ${ATT_JOB.MARK_ABSENT} hourly`);
    } catch (err) {
      this.logger.error(
        `Failed to schedule attendance jobs (is Redis up?): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async runJob(name: string) {
    if (name === ATT_JOB.MARK_ABSENT) {
      return this.attendance.markAbsentForPreviousDay();
    }
    throw new Error(`Unknown attendance job: ${name}`);
  }
}
