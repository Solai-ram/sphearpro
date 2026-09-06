import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SubscriptionJobsService,
  SUBSCRIPTION_JOBS_QUEUE,
} from './subscription-jobs.service';

@Processor(SUBSCRIPTION_JOBS_QUEUE, { concurrency: 1 })
export class SubscriptionJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionJobsProcessor.name);

  constructor(private jobs: SubscriptionJobsService) {
    super();
  }

  async process(job: Job) {
    this.logger.debug(`Running job ${job.name} id=${job.id}`);
    return this.jobs.runJob(job.name);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error(`Job ${job?.name} failed: ${err.message}`);
  }
}
