import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.module';

export type SubscriptionMailContext = {
  to: string;
  clinicName: string;
  planName: string;
  status?: string;
  periodEnd?: string | null;
  amountDisplay?: string;
  billingUrl?: string;
};

const product = () => process.env.PRODUCT_NAME || 'SPHEAR';

function billingUrl() {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/subscription`;
}

@Injectable()
export class SubscriptionMailService {
  private readonly logger = new Logger(SubscriptionMailService.name);

  constructor(private mail: MailService) {}

  async sendSafe(
    kind: string,
    ctx: SubscriptionMailContext,
    build: (ctx: SubscriptionMailContext & { billingUrl: string; product: string }) => {
      subject: string;
      text: string;
      html: string;
    },
  ) {
    if (!ctx.to) {
      this.logger.warn(`Skip ${kind}: no recipient email`);
      return;
    }
    const full = {
      ...ctx,
      billingUrl: ctx.billingUrl || billingUrl(),
      product: product(),
    };
    try {
      const msg = build(full);
      await this.mail.send({ to: ctx.to, ...msg });
    } catch (err) {
      this.logger.warn(
        `${kind} email failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  subscriptionCreated(ctx: SubscriptionMailContext) {
    return this.sendSafe('subscription_created', ctx, (c) => ({
      subject: `${c.product}: subscription created for ${c.clinicName}`,
      text: `Your ${c.planName} subscription was created for ${c.clinicName}. Complete payment if required: ${c.billingUrl}`,
      html: `<p>Your <strong>${c.planName}</strong> subscription was created for <strong>${c.clinicName}</strong>.</p><p><a href="${c.billingUrl}">Open billing</a></p>`,
    }));
  }

  paymentSucceeded(ctx: SubscriptionMailContext) {
    return this.sendSafe('payment_succeeded', ctx, (c) => ({
      subject: `${c.product}: payment received`,
      text: `Payment received for ${c.clinicName} (${c.planName}${c.amountDisplay ? ` · ${c.amountDisplay}` : ''}). Manage billing: ${c.billingUrl}`,
      html: `<p>Payment received for <strong>${c.clinicName}</strong> (${c.planName}${c.amountDisplay ? ` · ${c.amountDisplay}` : ''}).</p><p><a href="${c.billingUrl}">Manage billing</a></p>`,
    }));
  }

  paymentFailed(ctx: SubscriptionMailContext) {
    return this.sendSafe('payment_failed', ctx, (c) => ({
      subject: `${c.product}: payment failed — action needed`,
      text: `Payment failed for ${c.clinicName}. Update your payment method soon to avoid interruption: ${c.billingUrl}`,
      html: `<p>Payment <strong>failed</strong> for <strong>${c.clinicName}</strong>.</p><p>Please update your payment method to avoid service interruption.</p><p><a href="${c.billingUrl}">Fix billing</a></p>`,
    }));
  }

  renewed(ctx: SubscriptionMailContext) {
    return this.sendSafe('subscription_renewed', ctx, (c) => ({
      subject: `${c.product}: subscription renewed`,
      text: `Your ${c.planName} plan for ${c.clinicName} renewed.${c.periodEnd ? ` Next billing: ${c.periodEnd}.` : ''} ${c.billingUrl}`,
      html: `<p>Your <strong>${c.planName}</strong> plan for <strong>${c.clinicName}</strong> renewed.</p>${c.periodEnd ? `<p>Next billing date: ${c.periodEnd}</p>` : ''}<p><a href="${c.billingUrl}">Billing</a></p>`,
    }));
  }

  cancelled(ctx: SubscriptionMailContext) {
    return this.sendSafe('subscription_cancelled', ctx, (c) => ({
      subject: `${c.product}: subscription cancelled`,
      text: `Subscription for ${c.clinicName} was cancelled.${c.periodEnd ? ` Access until ${c.periodEnd}.` : ''} ${c.billingUrl}`,
      html: `<p>Subscription for <strong>${c.clinicName}</strong> was cancelled.</p>${c.periodEnd ? `<p>You keep access until <strong>${c.periodEnd}</strong>.</p>` : ''}<p><a href="${c.billingUrl}">Reactivate</a></p>`,
    }));
  }

  expiryReminder(ctx: SubscriptionMailContext, daysLeft: number) {
    return this.sendSafe(`expiry_reminder_${daysLeft}d`, ctx, (c) => ({
      subject: `${c.product}: subscription ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      text: `Reminder: ${c.clinicName} subscription (${c.planName}) ends in ${daysLeft} day(s)${c.periodEnd ? ` on ${c.periodEnd}` : ''}. Renew: ${c.billingUrl}`,
      html: `<p>Reminder: <strong>${c.clinicName}</strong> (${c.planName}) ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>${c.periodEnd ? ` (${c.periodEnd})` : ''}.</p><p><a href="${c.billingUrl}">Renew now</a></p>`,
    }));
  }

  expired(ctx: SubscriptionMailContext) {
    return this.sendSafe('subscription_expired', ctx, (c) => ({
      subject: `${c.product}: subscription expired`,
      text: `Your subscription for ${c.clinicName} has expired. Renew to continue using ${c.product}: ${c.billingUrl}`,
      html: `<p>Your subscription for <strong>${c.clinicName}</strong> has <strong>expired</strong>.</p><p>Renew to continue using ${c.product}.</p><p><a href="${c.billingUrl}">Renew now</a></p>`,
    }));
  }
}
