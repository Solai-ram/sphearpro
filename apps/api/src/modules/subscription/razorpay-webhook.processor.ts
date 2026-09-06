import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  RazorpayWebhookService,
  SUBSCRIPTION_QUEUE,
  RAZORPAY_WEBHOOK_JOB,
} from './razorpay-webhook.service';

@Processor(SUBSCRIPTION_QUEUE, {
  concurrency: 2,
})
export class RazorpayWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(RazorpayWebhookProcessor.name);

  constructor(private webhooks: RazorpayWebhookService) {
    super();
  }

  async process(job: Job<{ webhookEventId: string }>) {
    if (job.name !== RAZORPAY_WEBHOOK_JOB && job.name !== SUBSCRIPTION_QUEUE) {
      // accept default job names from queue.add
    }
    const id = job.data?.webhookEventId;
    if (!id) {
      this.logger.warn(`Job ${job.id} missing webhookEventId`);
      return;
    }
    await this.webhooks.processStoredEvent(id);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error(
      `Subscription webhook job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Subscription webhook job ${job.id} completed`);
  }
}
