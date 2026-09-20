import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ATTENDANCE_JOBS_QUEUE, AttendanceJobsService, ATT_JOB } from './attendance-jobs.service';

@Processor(ATTENDANCE_JOBS_QUEUE, { concurrency: 1 })
export class AttendanceJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceJobsProcessor.name);

  constructor(private jobs: AttendanceJobsService) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Running attendance job ${job.name}`);
    return this.jobs.runJob(job.name);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error(`Attendance job failed ${job?.name}: ${err.message}`);
  }
}
