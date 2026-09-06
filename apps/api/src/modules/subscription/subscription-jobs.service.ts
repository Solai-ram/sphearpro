import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { SubscriptionMailService } from './subscription-mail.service';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { addDays, assertTransition, SUBSCRIPTION_EVENT } from './subscription-state';

export const SUBSCRIPTION_JOBS_QUEUE = 'subscription-jobs';

export const SUB_JOB = {
  EXPIRY_CHECK: 'subscription-expiry-check',
  PAYMENT_REMINDER: 'payment-reminder',
  RECONCILIATION: 'subscription-reconciliation',
  INVOICE_GENERATION: 'invoice-generation',
  WEBHOOK_RETRY: 'webhook-failure-retry',
} as const;

@Injectable()
export class SubscriptionJobsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionJobsService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    @InjectQueue(SUBSCRIPTION_JOBS_QUEUE) private queue: Queue,
    private mail: SubscriptionMailService,
    private razorpay: RazorpayService,
    private webhooks: RazorpayWebhookService,
  ) {}

  async onModuleInit() {
    if (process.env.SUBSCRIPTION_JOBS_DISABLED === 'true') {
      this.logger.warn('Subscription scheduled jobs disabled (SUBSCRIPTION_JOBS_DISABLED=true)');
      return;
    }
    try {
      await this.ensureRepeatableJobs();
    } catch (err) {
      this.logger.error(
        `Failed to schedule subscription jobs (is Redis up?): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async ensureRepeatableJobs() {
    const specs: Array<{ name: string; everyMs: number }> = [
      { name: SUB_JOB.EXPIRY_CHECK, everyMs: 60 * 60 * 1000 },
      { name: SUB_JOB.PAYMENT_REMINDER, everyMs: 24 * 60 * 60 * 1000 },
      { name: SUB_JOB.RECONCILIATION, everyMs: 6 * 60 * 60 * 1000 },
      { name: SUB_JOB.WEBHOOK_RETRY, everyMs: 30 * 60 * 1000 },
      { name: SUB_JOB.INVOICE_GENERATION, everyMs: 24 * 60 * 60 * 1000 },
    ];

    for (const spec of specs) {
      await this.queue.add(
        spec.name,
        { scheduled: true },
        {
          jobId: `repeat:${spec.name}`,
          repeat: { every: spec.everyMs },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      this.logger.log(`Scheduled ${spec.name} every ${spec.everyMs}ms`);
    }
  }

  async runJob(name: string) {
    switch (name) {
      case SUB_JOB.EXPIRY_CHECK:
        return this.runExpiryCheck();
      case SUB_JOB.PAYMENT_REMINDER:
        return this.runPaymentReminders();
      case SUB_JOB.RECONCILIATION:
        return this.runReconciliation();
      case SUB_JOB.WEBHOOK_RETRY:
        return this.runWebhookRetry();
      case SUB_JOB.INVOICE_GENERATION:
        return this.runInvoiceGenerationStub();
      default:
        throw new Error(`Unknown job: ${name}`);
    }
  }

  /** Hourly: expire grace/cancel-at-period-end / ended trials. */
  async runExpiryCheck() {
    const now = new Date();
    let expired = 0;
    let cancelled = 0;

    const graceDue = await this.prisma.subscription.findMany({
      where: {
        status: 'GRACE_PERIOD',
        gracePeriodEnd: { lte: now },
      },
      include: { clinic: true, plan: true },
    });

    for (const sub of graceDue) {
      assertTransition(sub.status, 'EXPIRED');
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED', endedAt: now },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            clinicId: sub.clinicId,
            eventType: SUBSCRIPTION_EVENT.EXPIRED,
            oldStatus: sub.status,
            newStatus: 'EXPIRED',
            metadata: { source: 'subscription-expiry-check' },
          },
        });
      });
      expired += 1;
      await this.mail.expired({
        to: sub.clinic.email || '',
        clinicName: sub.clinic.name,
        planName: sub.plan.name,
      });
    }

    // Expire TRIALING subscriptions whose trial period has ended
    const trialDue = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEnd: { not: null, lte: now },
      },
      include: { clinic: true, plan: true },
    });

    for (const sub of trialDue) {
      assertTransition(sub.status, 'EXPIRED');
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED', endedAt: now },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            clinicId: sub.clinicId,
            eventType: SUBSCRIPTION_EVENT.EXPIRED,
            oldStatus: sub.status,
            newStatus: 'EXPIRED',
            metadata: { source: 'subscription-expiry-check', trigger: 'trial_expired' },
          },
        });
      });
      expired += 1;
      await this.mail.expired({
        to: sub.clinic.email || '',
        clinicName: sub.clinic.name,
        planName: sub.plan.name,
      });
    }

    const cancelDue = await this.prisma.subscription.findMany({
      where: {
        cancelAtPeriodEnd: true,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        currentPeriodEnd: { lte: now },
      },
      include: { clinic: true, plan: true },
    });

    for (const sub of cancelDue) {
      assertTransition(sub.status, 'CANCELLED');
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            endedAt: now,
            cancelAtPeriodEnd: false,
          },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            clinicId: sub.clinicId,
            eventType: SUBSCRIPTION_EVENT.CANCELLED,
            oldStatus: sub.status,
            newStatus: 'CANCELLED',
            metadata: { source: 'subscription-expiry-check', mode: 'period_end' },
          },
        });
      });
      cancelled += 1;
      await this.mail.cancelled({
        to: sub.clinic.email || '',
        clinicName: sub.clinic.name,
        planName: sub.plan.name,
        periodEnd: sub.currentPeriodEnd?.toISOString() || null,
      });
    }

    this.logger.log(`Expiry check: expired=${expired} cancelledAtPeriodEnd=${cancelled}`);
    return { expired, cancelled };
  }

  /** Daily: remind clinics whose period ends in 3 or 1 days. */
  async runPaymentReminders() {
    const now = new Date();
    let sent = 0;

    for (const days of [3, 1]) {
      const start = addDays(now, days);
      start.setUTCHours(0, 0, 0, 0);
      const end = addDays(start, 1);

      const rows = await this.prisma.subscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
          currentPeriodEnd: { gte: start, lt: end },
        },
        include: { clinic: true, plan: true },
      });

      for (const sub of rows) {
        if (!sub.clinic.email) continue;
        await this.mail.expiryReminder(
          {
            to: sub.clinic.email,
            clinicName: sub.clinic.name,
            planName: sub.plan.name,
            periodEnd: sub.currentPeriodEnd?.toISOString() || null,
          },
          days,
        );
        sent += 1;
      }
    }

    this.logger.log(`Payment reminders sent=${sent}`);
    return { sent };
  }

  /**
   * Every 6h: compare Razorpay subscription status to local DB.
   * Default dry-run (log only). Set SUBSCRIPTION_RECONCILE_APPLY=true to patch local status.
   */
  async runReconciliation() {
    if (!this.razorpay.isConfigured()) {
      this.logger.log('Reconciliation skipped — Razorpay not configured');
      return { skipped: true, mismatches: [] as any[] };
    }

    const apply = process.env.SUBSCRIPTION_RECONCILE_APPLY === 'true';
    const rows = await this.prisma.subscription.findMany({
      where: {
        provider: 'razorpay',
        providerSubscriptionId: { not: null },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      take: 200,
      orderBy: { updatedAt: 'asc' },
    });

    const mismatches: Array<{
      id: string;
      local: string;
      remote: string;
      providerSubscriptionId: string;
    }> = [];

    for (const sub of rows) {
      const providerId = sub.providerSubscriptionId!;
      try {
        const remote = await this.razorpay.fetchSubscription(providerId);
        const remoteStatus = String(remote.status || '').toLowerCase();
        const expectedLocal = mapRazorpayStatus(remoteStatus);
        if (expectedLocal && expectedLocal !== sub.status) {
          mismatches.push({
            id: sub.id,
            local: sub.status,
            remote: remoteStatus,
            providerSubscriptionId: providerId,
          });
          if (apply) {
            try {
              assertTransition(sub.status, expectedLocal);
              await this.prisma.subscription.update({
                where: { id: sub.id },
                data: { status: expectedLocal },
              });
              await this.prisma.subscriptionEvent.create({
                data: {
                  subscriptionId: sub.id,
                  clinicId: sub.clinicId,
                  eventType: 'SUBSCRIPTION_RECONCILED',
                  oldStatus: sub.status,
                  newStatus: expectedLocal,
                  metadata: { remoteStatus, source: 'subscription-reconciliation' },
                },
              });
            } catch (err) {
              this.logger.warn(
                `Reconcile apply skipped ${sub.id}: ${err instanceof Error ? err.message : err}`,
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `Reconcile fetch failed ${providerId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(
      `Reconciliation mismatches=${mismatches.length} apply=${apply}`,
    );
    return { skipped: false, apply, mismatches };
  }

  /** Re-queue unprocessed webhooks that have errors (delayed/missing delivery recovery). */
  async runWebhookRetry() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const rows = await this.prisma.webhookEvent.findMany({
      where: {
        processed: false,
        provider: 'razorpay',
        createdAt: { lte: cutoff },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    let retried = 0;
    for (const row of rows) {
      try {
        await this.webhooks.processStoredEvent(row.id);
        retried += 1;
      } catch (err) {
        this.logger.warn(
          `Webhook retry failed ${row.eventId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    this.logger.log(`Webhook retry processed=${retried}`);
    return { retried, candidates: rows.length };
  }

  async runInvoiceGenerationStub() {
    this.logger.log(
      'Invoice generation: provider-driven (Razorpay) — no local generation in MVP',
    );
    return { generated: 0, note: 'provider-driven' };
  }
}

function mapRazorpayStatus(
  remote: string,
): 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED' | 'TRIALING' | null {
  switch (remote) {
    case 'active':
      return 'ACTIVE';
    case 'authenticated':
    case 'created':
      return 'TRIALING';
    case 'cancelled':
      return 'CANCELLED';
    case 'completed':
      return 'EXPIRED';
    case 'halted':
    case 'paused':
      return 'SUSPENDED';
    case 'pending':
      return null; // keep local grace/payment_failed handling
    default:
      return null;
  }
}

export const __test = { mapRazorpayStatus };
