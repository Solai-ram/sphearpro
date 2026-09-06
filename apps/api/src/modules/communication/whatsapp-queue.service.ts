import { Injectable, Inject } from '@nestjs/common';

/**
 * WhatsAppQueueService provides methods to interact with the WhatsApp BullMQ queue.
 * This is a thin wrapper around BullMQ Queue for advanced operations (pause, resume, metrics).
 */
@Injectable()
export class WhatsAppQueueService {
  constructor(@Inject('BullQueue_whatsapp') private whatsappQueue: any) {}

  /** Get queue metrics (waiting, active, completed, failed) */
  async getMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.whatsappQueue.getWaitingCount(),
      this.whatsappQueue.getActiveCount(),
      this.whatsappQueue.getCompletedCount(),
      this.whatsappQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  /** Pause the queue (stops processing) */
  async pause() {
    await this.whatsappQueue.pause();
    return { message: 'WhatsApp queue paused' };
  }

  /** Resume the queue */
  async resume() {
    await this.whatsappQueue.resume();
    return { message: 'WhatsApp queue resumed' };
  }

  /** Get all jobs (for debugging) */
  async getJobs(types: ('waiting' | 'active' | 'completed' | 'failed')[] = ['waiting', 'active', 'completed', 'failed']) {
    const jobs: any[] = [];
    if (types.includes('waiting')) jobs.push(...(await this.whatsappQueue.getWaiting()));
    if (types.includes('active')) jobs.push(...(await this.whatsappQueue.getActive()));
    if (types.includes('completed')) jobs.push(...(await this.whatsappQueue.getCompleted()));
    if (types.includes('failed')) jobs.push(...(await this.whatsappQueue.getFailed()));
    return jobs.map(j => ({
      id: j.id,
      name: j.name,
      data: j.data,
      progress: j.progress,
      attemptsMade: j.attemptsMade,
      failedReason: j.failedReason,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
    }));
  }

  /** Remove a job by ID */
  async removeJob(jobId: string) {
    const job = await this.whatsappQueue.getJob(jobId);
    if (job) await job.remove();
    return { message: 'Job removed' };
  }

  /** Clean old completed/failed jobs */
  async clean(gracePeriodMs = 24 * 60 * 60 * 1000, limit = 100) {
    await this.whatsappQueue.clean(gracePeriodMs, limit, 'completed');
    await this.whatsappQueue.clean(gracePeriodMs, limit, 'failed');
    return { message: 'Queue cleaned' };
  }
}