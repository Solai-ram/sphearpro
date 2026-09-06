import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { RazorpayService } from './razorpay.service';
import { SubscriptionService } from './subscription.service';
import { SAAS_ERROR, SaasHttpException } from './razorpay.errors';
import { HttpStatus } from '@nestjs/common';

export const RAZORPAY_PROVIDER = 'razorpay';
export const SUBSCRIPTION_QUEUE = 'subscription';
export const RAZORPAY_WEBHOOK_JOB = 'razorpay-webhook';

export type RazorpayWebhookEnvelope = {
  id?: string;
  event?: string;
  payload?: {
    subscription?: { entity?: Record<string, any> };
    payment?: { entity?: Record<string, any> };
  };
  [key: string]: unknown;
};

@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private razorpay: RazorpayService,
    private subscriptions: SubscriptionService,
    @InjectQueue(SUBSCRIPTION_QUEUE) private queue: Queue,
  ) {}

  /**
   * Verify signature, upsert WebhookEvent, enqueue (or process sync).
   * Returns quickly for Razorpay.
   */
  async ingest(
    rawBody: Buffer | string,
    signature: string | undefined,
    headerEventId?: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: SAAS_ERROR.INVALID_WEBHOOK_SIGNATURE,
          message: 'Missing X-Razorpay-Signature',
        },
      });
    }

    const raw = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let valid = false;
    try {
      valid = this.razorpay.verifyWebhook(raw, signature);
    } catch (err) {
      if (err instanceof SaasHttpException) throw err;
      throw new UnauthorizedException({
        success: false,
        error: {
          code: SAAS_ERROR.INVALID_WEBHOOK_SIGNATURE,
          message: 'Webhook verification failed',
        },
      });
    }

    if (!valid) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: SAAS_ERROR.INVALID_WEBHOOK_SIGNATURE,
          message: 'Invalid Razorpay webhook signature',
        },
      });
    }

    let parsed: RazorpayWebhookEnvelope;
    try {
      parsed = JSON.parse(raw) as RazorpayWebhookEnvelope;
    } catch {
      throw new SaasHttpException(
        SAAS_ERROR.RAZORPAY_PROVIDER_ERROR,
        'Invalid webhook JSON body',
        HttpStatus.BAD_REQUEST,
      );
    }

    const eventType = String(parsed.event || 'unknown');
    const eventId =
      headerEventId ||
      (typeof parsed.id === 'string' && parsed.id ? parsed.id : null) ||
      createHash('sha256').update(raw).digest('hex').slice(0, 40);

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: { provider: RAZORPAY_PROVIDER, eventId },
      },
    });

    if (existing?.processed) {
      this.logger.log(`Webhook ${eventId} already processed — skip`);
      return { received: true, duplicate: true, processed: true, eventId, eventType };
    }

    const row =
      existing ||
      (await this.prisma.webhookEvent.create({
        data: {
          provider: RAZORPAY_PROVIDER,
          eventId,
          eventType,
          payload: parsed as Prisma.InputJsonValue,
          signature,
          processed: false,
        },
      }));

    if (existing && !existing.processed) {
      // Re-delivery of unprocessed event — keep original payload
      this.logger.log(`Webhook ${eventId} re-delivered (unprocessed) — re-queue`);
    }

    const sync = process.env.RAZORPAY_WEBHOOK_SYNC === 'true';
    if (sync) {
      await this.processStoredEvent(row.id);
      return { received: true, duplicate: false, processed: true, eventId, eventType, mode: 'sync' };
    }

    try {
      await this.queue.add(
        RAZORPAY_WEBHOOK_JOB,
        { webhookEventId: row.id },
        {
          jobId: `razorpay:${eventId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (err) {
      this.logger.warn(
        `BullMQ enqueue failed for ${eventId}; processing synchronously: ${
          err instanceof Error ? err.message : err
        }`,
      );
      await this.processStoredEvent(row.id);
      return {
        received: true,
        duplicate: Boolean(existing),
        processed: true,
        eventId,
        eventType,
        mode: 'sync-fallback',
      };
    }

    return {
      received: true,
      duplicate: Boolean(existing),
      processed: false,
      queued: true,
      eventId,
      eventType,
      mode: 'queue',
    };
  }

  /** Worker entry — idempotent by WebhookEvent.processed. */
  async processStoredEvent(webhookEventId: string) {
    const row = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });
    if (!row) {
      this.logger.warn(`WebhookEvent ${webhookEventId} not found`);
      return;
    }
    if (row.processed) {
      this.logger.log(`WebhookEvent ${webhookEventId} already processed`);
      return;
    }

    try {
      await this.applyPayload(row.eventType, row.payload as RazorpayWebhookEnvelope);
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: {
          processed: true,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
      this.logger.log(`Webhook ${row.eventId} (${row.eventType}) processed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { errorMessage: message.slice(0, 2000) },
      });
      this.logger.error(`Webhook ${row.eventId} failed: ${message}`);
      throw err; // allow BullMQ retry
    }
  }

  async applyPayload(eventType: string, envelope: RazorpayWebhookEnvelope) {
    const subEntity = envelope?.payload?.subscription?.entity;
    const payEntity = envelope?.payload?.payment?.entity;
    const providerSubscriptionId = subEntity?.id as string | undefined;

    // payment.failed may only include payment; notes may carry subscription id
    const fromPaymentNotes =
      (payEntity?.notes?.subscription_id as string | undefined) ||
      (payEntity?.notes?.subscriptionId as string | undefined);

    const providerSubId = providerSubscriptionId || fromPaymentNotes;

    switch (eventType) {
      case 'subscription.activated':
        if (!providerSubId) throw new Error('Missing subscription id on activated');
        await this.subscriptions.applyProviderActivated(providerSubId, {
          providerPaymentId: payEntity?.id,
          amountPaise: typeof payEntity?.amount === 'number' ? payEntity.amount : undefined,
          currency: payEntity?.currency,
          metadata: { razorpayEvent: eventType },
        });
        break;

      case 'subscription.charged':
        if (!providerSubId) throw new Error('Missing subscription id on charged');
        await this.subscriptions.applyProviderCharged(providerSubId, {
          providerPaymentId: payEntity?.id,
          amountPaise: typeof payEntity?.amount === 'number' ? payEntity.amount : undefined,
          currency: payEntity?.currency,
          metadata: { razorpayEvent: eventType },
        });
        break;

      case 'subscription.pending':
      case 'subscription.halted':
      case 'payment.failed':
        if (providerSubId) {
          if (eventType === 'subscription.halted') {
            await this.subscriptions.applyProviderHalted(providerSubId, {
              reason: eventType,
              metadata: { razorpayEvent: eventType },
            });
          } else {
            await this.subscriptions.applyProviderPaymentFailed(providerSubId, {
              providerPaymentId: payEntity?.id,
              amountPaise: typeof payEntity?.amount === 'number' ? payEntity.amount : undefined,
              currency: payEntity?.currency,
              failureReason:
                (payEntity?.error_description as string) ||
                (payEntity?.error_reason as string) ||
                eventType,
              metadata: { razorpayEvent: eventType },
            });
          }
        } else {
          this.logger.warn(`${eventType}: no subscription id — ignore`);
        }
        break;

      case 'subscription.cancelled':
      case 'subscription.completed':
        if (!providerSubId) throw new Error(`Missing subscription id on ${eventType}`);
        await this.subscriptions.applyProviderCancelled(providerSubId, {
          completed: eventType === 'subscription.completed',
          metadata: { razorpayEvent: eventType },
        });
        break;

      case 'subscription.updated':
      case 'subscription.authenticated':
      case 'subscription.paused':
      case 'subscription.resumed':
        this.logger.log(`${eventType}: acknowledged (no local status change required)`);
        break;

      default:
        this.logger.log(`Unhandled Razorpay event ${eventType} — stored only`);
    }
  }
}
