import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import {
  PrismaClient,
  SubscriptionStatus,
  Subscription,
  Prisma,
} from '@prisma/client';
import {
  ACCESS_ALLOWED_STATUSES,
  SUBSCRIPTION_EVENT,
  accessWhileCancelPending,
  addDays,
  addMonths,
  assertTransition,
  canAccessHis,
} from './subscription-state';
import { RazorpayService } from './razorpay.service';
import { SAAS_ERROR, SaasHttpException } from './razorpay.errors';
import { SubscriptionMailService } from './subscription-mail.service';
import {
  billingPeriodMonths,
  formatInrPaise,
  isAdminStaffType,
  planBillingAmountPaise,
  roleIdsIncludeAdmin,
  STANDARD_MONTHLY_CODE,
} from './subscription-plan.util';

const GRACE_DAYS = () => Number(process.env.SUBSCRIPTION_GRACE_DAYS || 5);

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private razorpay: RazorpayService,
    private mail: SubscriptionMailService,
  ) {}

  /** Public catalogue of active sellable plans with features. */
  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        planFeatures: {
          include: { feature: true },
          orderBy: { feature: { code: 'asc' } },
        },
      },
    });

    return plans.map((plan) => this.mapPlan(plan));
  }

  async getPlanByCode(code: string) {
    const plans = await this.listPlans();
    return plans.find((p) => p.code === code) || null;
  }

  async getSubscription(clinicId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: {
            planFeatures: { include: { feature: true } },
          },
        },
      },
    });
    if (!sub) return null;
    return this.mapSubscription(sub);
  }

  /**
   * Create a local subscription for the clinic (pre-Razorpay / after plan pick).
   * Status starts as TRIALING when trialDays > 0, otherwise awaiting activate (TRIALING with trialDays 0).
   * Does not grant lasting access until activateSubscription (except during real trial).
   */
  async createSubscription(clinicId: string, planCode: string, actorId?: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode.toUpperCase(), isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const existingActive = await this.prisma.subscription.findFirst({
      where: {
        clinicId,
        status: { in: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'PAYMENT_FAILED'] },
      },
    });
    if (existingActive) {
      throw new ConflictException('Clinic already has an active or in-flight subscription');
    }

    const now = new Date();
    // Always provide a short free trial for new clinics.
    // Even if the DB plan still has `trialDays=0`, fall back to the configured default.
    const defaultTrialDays = Number(process.env.SUBSCRIPTION_TRIAL_DAYS || 7);
    const trialDays = plan.trialDays > 0 ? plan.trialDays : defaultTrialDays;
    const status: SubscriptionStatus = 'TRIALING';
    const trialStart = trialDays > 0 ? now : null;
    const trialEnd = trialDays > 0 ? addDays(now, trialDays) : null;

    const chargePaise = planBillingAmountPaise(plan);
    const periodMonths = billingPeriodMonths(plan.billingInterval);

    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          clinicId,
          planId: plan.id,
          provider: 'manual',
          status,
          amountPaise: chargePaise,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          startDate: now,
          trialStart,
          trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(now, periodMonths),
        },
        include: { plan: true },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: created.id,
          clinicId,
          eventType: SUBSCRIPTION_EVENT.CREATED,
          oldStatus: null,
          newStatus: status,
          metadata: { planCode: plan.code, actorId: actorId || null },
        },
      });

      return created;
    });

    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    void this.mail.subscriptionCreated({
      to: clinic?.email || '',
      clinicName: clinic?.name || 'Clinic',
      planName: plan.name,
    });

    return this.getSubscription(clinicId);
  }

  /**
   * Start Razorpay Checkout for the clinic's SaaS plan.
   * Uses Standard Orders when no Razorpay Plan ID is configured;
   * otherwise creates a provider subscription (recurring).
   * Does **not** activate until verify/confirm (or webhook for subscriptions).
   */
  async startCheckout(
    clinicId: string,
    opts?: { planCode?: string; actorId?: string },
  ) {
    if (!this.razorpay.isConfigured()) {
      throw new SaasHttpException(
        SAAS_ERROR.RAZORPAY_NOT_CONFIGURED,
        'Razorpay is not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, or use POST /subscription/activate for local/dev.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const planCode = (opts?.planCode || process.env.SAAS_DEFAULT_PLAN_CODE || 'STANDARD').toUpperCase();
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) {
      throw new SaasHttpException(SAAS_ERROR.PLAN_NOT_FOUND, `Plan ${planCode} not found`);
    }

    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const blocking = await this.prisma.subscription.findFirst({
      where: {
        clinicId,
        status: { in: ['ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'PAYMENT_FAILED'] },
      },
    });
    if (blocking) {
      throw new ConflictException('Clinic already has an active or recoverable subscription');
    }

    // Prefer Standard Orders unless a Razorpay Plan ID is configured for recurring Billing.
    // Avoids RAZORPAY_PLAN_MISSING when only KEY_ID / KEY_SECRET are set.
    if (!this.razorpay.hasProviderPlanId(plan.billingInterval)) {
      return this.startStandardOrderCheckout(clinicId, plan, clinic, opts);
    }

    return this.startSubscriptionCheckout(clinicId, plan, clinic, opts);
  }

  /** Standard Web Checkout (one-time order) — works with KEY_ID + KEY_SECRET only. */
  private async startStandardOrderCheckout(
    clinicId: string,
    plan: {
      id: string;
      name: string;
      code: string;
      description: string | null;
      monthlyPricePaise: number;
      currency: string;
      billingInterval: 'MONTHLY' | 'YEARLY';
    },
    clinic: { id: string; name: string; email: string | null; phone: string | null; slug: string },
    opts?: { actorId?: string },
  ) {
    const chargePaise = planBillingAmountPaise(plan);
    const periodMonths = billingPeriodMonths(plan.billingInterval);
    const now = new Date();

    let local = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!local || ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(local.status)) {
      local = await this.prisma.$transaction(async (tx) => {
        const created = await tx.subscription.create({
          data: {
            clinicId,
            planId: plan.id,
            provider: 'razorpay',
            status: 'TRIALING',
            amountPaise: chargePaise,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            startDate: now,
            trialStart: null,
            trialEnd: null,
            currentPeriodStart: now,
            currentPeriodEnd: addMonths(now, periodMonths),
          },
          include: { plan: true },
        });
        await this.writeEvent(tx, {
          subscriptionId: created.id,
          clinicId,
          eventType: SUBSCRIPTION_EVENT.CREATED,
          oldStatus: null,
          newStatus: 'TRIALING',
          metadata: {
            provider: 'razorpay',
            checkoutMode: 'order',
            actorId: opts?.actorId || null,
          },
        });
        return created;
      });
    } else {
      local = await this.prisma.subscription.update({
        where: { id: local.id },
        data: {
          planId: plan.id,
          provider: 'razorpay',
          status: 'TRIALING',
          amountPaise: chargePaise,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
        },
        include: { plan: true },
      });
    }

    const order = await this.razorpay.createOrder({
      amount: chargePaise,
      currency: plan.currency,
      receipt: `sub_${local.id.slice(-12)}_${Date.now()}`.slice(0, 40),
      notes: {
        clinicId,
        localSubscriptionId: local.id,
        planCode: plan.code,
      },
    });

    await this.prisma.subscriptionPayment.create({
      data: {
        clinicId,
        subscriptionId: local.id,
        provider: 'razorpay',
        providerOrderId: order.id,
        amountPaise: chargePaise,
        currency: plan.currency,
        status: 'PENDING',
      },
    });

    const intervalLabel = plan.billingInterval === 'YEARLY' ? 'yearly' : 'monthly';
    this.logger.log(
      `Standard order checkout clinic=${clinicId} localSub=${local.id} order=${order.id} amountPaise=${chargePaise}`,
    );

    return {
      checkoutMode: 'order' as const,
      keyId: this.razorpay.getPublicKeyId(),
      mode: this.razorpay.getMode(),
      order_id: order.id,
      razorpayOrderId: order.id,
      localSubscriptionId: local.id,
      amountPaise: chargePaise,
      amount: chargePaise,
      currency: plan.currency,
      planCode: plan.code,
      billingInterval: plan.billingInterval,
      name: process.env.PRODUCT_NAME || 'SPHEAR',
      description: `${plan.name} — ${intervalLabel} plan`,
      prefill: {
        name: clinic.name,
        email: clinic.email || undefined,
        contact: clinic.phone || undefined,
      },
      notes: {
        clinicId: clinic.id,
        localSubscriptionId: local.id,
      },
      activation: 'confirm',
    };
  }

  private async startSubscriptionCheckout(
    clinicId: string,
    plan: {
      id: string;
      name: string;
      code: string;
      description: string | null;
      monthlyPricePaise: number;
      currency: string;
      billingInterval: 'MONTHLY' | 'YEARLY';
    },
    clinic: { id: string; name: string; email: string | null; phone: string | null; slug: string },
    opts?: { actorId?: string },
  ) {
    let local = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    // Reuse open Razorpay subscription still awaiting auth payment
    if (
      local &&
      local.provider === 'razorpay' &&
      local.providerSubscriptionId &&
      local.status === 'TRIALING'
    ) {
      const remote = await this.razorpay.fetchSubscription(local.providerSubscriptionId);
      const reopenable = ['created', 'authenticated', 'pending'].includes(
        String(remote.status || ''),
      );
      if (reopenable) {
        return { checkoutMode: 'subscription' as const, ...this.buildCheckoutPayload(local, clinic, plan) };
      }
    }

    const providerPlanId = this.razorpay.getProviderPlanId(plan.billingInterval);
    const totalCount = this.razorpay.getSubscriptionTotalCount(plan.billingInterval);
    const trialDays = this.razorpay.getCheckoutTrialDays();
    const startAt = this.razorpay.getTrialStartAtUnix(trialDays);
    const chargePaise = planBillingAmountPaise(plan);

    let providerCustomerId = local?.providerCustomerId || null;
    if (!providerCustomerId) {
      const customer = await this.razorpay.createCustomer({
        name: clinic.name,
        email: clinic.email,
        contact: clinic.phone,
        notes: { clinicId, clinicSlug: clinic.slug },
      });
      providerCustomerId = customer.id;
    }

    const remoteSub = await this.razorpay.createSubscription({
      planId: providerPlanId,
      totalCount,
      customerId: providerCustomerId,
      startAt,
      notes: {
        clinicId,
        clinicSlug: clinic.slug,
        planCode: plan.code,
        localSubscriptionId: local?.id || '',
        trialDays: String(trialDays),
      },
    });

    const now = new Date();
    // Trial window is applied only after Checkout signature confirm — avoids access on abandoned modals.
    if (!local || ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(local.status)) {
      local = await this.prisma.$transaction(async (tx) => {
        const created = await tx.subscription.create({
          data: {
            clinicId,
            planId: plan.id,
            provider: 'razorpay',
            providerCustomerId,
            providerSubscriptionId: remoteSub.id,
            status: 'TRIALING',
            amountPaise: chargePaise,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            startDate: now,
            trialStart: null,
            trialEnd: null,
            currentPeriodStart: now,
            currentPeriodEnd: addDays(now, trialDays),
          },
          include: { plan: true },
        });
        await this.writeEvent(tx, {
          subscriptionId: created.id,
          clinicId,
          eventType: SUBSCRIPTION_EVENT.CREATED,
          oldStatus: null,
          newStatus: 'TRIALING',
          metadata: {
            provider: 'razorpay',
            providerSubscriptionId: remoteSub.id,
            startAt,
            trialDays,
            actorId: opts?.actorId || null,
          },
        });
        return created;
      });
    } else {
      local = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({
          where: { id: local!.id },
          data: {
            planId: plan.id,
            provider: 'razorpay',
            providerCustomerId,
            providerSubscriptionId: remoteSub.id,
            status: 'TRIALING',
            amountPaise: chargePaise,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            trialStart: null,
            trialEnd: null,
            currentPeriodStart: now,
            currentPeriodEnd: addDays(now, trialDays),
          },
          include: { plan: true },
        });
        await this.writeEvent(tx, {
          subscriptionId: updated.id,
          clinicId,
          eventType: SUBSCRIPTION_EVENT.CREATED,
          oldStatus: local!.status,
          newStatus: 'TRIALING',
          metadata: {
            provider: 'razorpay',
            providerSubscriptionId: remoteSub.id,
            startAt,
            trialDays,
            actorId: opts?.actorId || null,
          },
        });
        return updated;
      });
    }

    this.logger.log(
      `Checkout started clinic=${clinicId} localSub=${local.id} providerSub=${remoteSub.id} start_at=${startAt} trialDays=${trialDays}`,
    );

    return { checkoutMode: 'subscription' as const, ...this.buildCheckoutPayload(local, clinic, plan, trialDays) };
  }

  /**
   * Verify frontend Checkout success signature and record payment.
   * Does **not** activate — Razorpay webhooks remain the activation authority.
   */
  async confirmCheckout(
    clinicId: string,
    body: {
      razorpay_payment_id: string;
      razorpay_signature: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
    },
    opts?: { actorId?: string },
  ) {
    if (body.razorpay_order_id) {
      return this.confirmOrderCheckout(clinicId, {
        razorpay_order_id: body.razorpay_order_id,
        razorpay_payment_id: body.razorpay_payment_id,
        razorpay_signature: body.razorpay_signature,
      }, opts);
    }

    if (!body.razorpay_subscription_id) {
      throw new BadRequestException(
        'razorpay_order_id or razorpay_subscription_id is required with payment id and signature',
      );
    }

    const sub = await this.requireLatest(clinicId);
    if (
      !sub.providerSubscriptionId ||
      sub.providerSubscriptionId !== body.razorpay_subscription_id
    ) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_SUBSCRIPTION,
        'Subscription id does not match this clinic',
      );
    }

    const ok = this.razorpay.verifySubscriptionPayment(
      body.razorpay_payment_id,
      body.razorpay_subscription_id,
      body.razorpay_signature,
    );
    if (!ok) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_PAYMENT_SIGNATURE,
        'Invalid Razorpay payment signature',
      );
    }

    const existing = await this.prisma.subscriptionPayment.findFirst({
      where: { providerPaymentId: body.razorpay_payment_id },
    });
    if (!existing) {
      await this.prisma.subscriptionPayment.create({
        data: {
          clinicId,
          subscriptionId: sub.id,
          provider: 'razorpay',
          providerPaymentId: body.razorpay_payment_id,
          amountPaise: sub.amountPaise,
          currency: sub.currency,
          status: 'AUTHORIZED',
          paidAt: new Date(),
        },
      });
    }

    // Open the free-trial window after authenticated Checkout (Razorpay charges at start_at).
    const trialDays = this.razorpay.getCheckoutTrialDays();
    const now = new Date();
    const trialEnd = addDays(now, trialDays);
    if (!sub.trialEnd || sub.trialEnd.getTime() < now.getTime()) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          trialStart: sub.trialStart || now,
          trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        },
      });
    }

    this.logger.log(
      `Checkout signature verified clinic=${clinicId} payment=${body.razorpay_payment_id} trialEnds=${trialEnd.toISOString()} — awaiting webhook for ACTIVE`,
    );

    return {
      verified: true,
      activated: false,
      awaitingWebhook: true,
      message:
        'Payment method saved. Your 7-day free trial is active — billed after the trial via Razorpay.',
      subscription: await this.getSubscription(clinicId),
      actorId: opts?.actorId || null,
    };
  }

  /** Verify Standard Checkout order signature and activate the clinic subscription. */
  async confirmOrderCheckout(
    clinicId: string,
    body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
    opts?: { actorId?: string },
  ) {
    const ok = this.razorpay.verifyPayment(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
    if (!ok) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_PAYMENT_SIGNATURE,
        'Payment signature mismatch — payment not marked as paid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pending = await this.prisma.subscriptionPayment.findFirst({
      where: {
        clinicId,
        providerOrderId: body.razorpay_order_id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_SUBSCRIPTION,
        'No pending order found for this clinic',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingPay = await this.prisma.subscriptionPayment.findFirst({
      where: { providerPaymentId: body.razorpay_payment_id },
    });
    if (!existingPay) {
      await this.prisma.subscriptionPayment.update({
        where: { id: pending.id },
        data: {
          providerPaymentId: body.razorpay_payment_id,
          status: 'CAPTURED',
          paidAt: new Date(),
        },
      });
    }

    const sub = await this.requireLatest(clinicId);
    if (sub.status !== 'ACTIVE') {
      await this.activateSubscription(clinicId, { actorId: opts?.actorId });
    }

    this.logger.log(
      `Standard order payment verified+activated clinic=${clinicId} order=${body.razorpay_order_id} payment=${body.razorpay_payment_id}`,
    );

    return {
      verified: true,
      activated: true,
      awaitingWebhook: false,
      message: 'Payment verified. Subscription is active.',
      subscription: await this.getSubscription(clinicId),
      actorId: opts?.actorId || null,
    };
  }

  private buildCheckoutPayload(
    local: Subscription & { plan?: { name: string; code: string; description: string | null } | null },
    clinic: { id: string; name: string; email: string | null; phone: string | null },
    plan: {
      name: string;
      code: string;
      description: string | null;
      monthlyPricePaise: number;
      currency: string;
      billingInterval: 'MONTHLY' | 'YEARLY';
    },
    trialDays = this.razorpay.getCheckoutTrialDays(),
  ) {
    const chargePaise = planBillingAmountPaise(plan);
    const amountLabel = formatInrPaise(chargePaise);
    const thenLabel =
      plan.billingInterval === 'YEARLY'
        ? `${trialDays} days free · Then ${amountLabel}/year`
        : `${trialDays} days free · Then ${amountLabel}/month`;
    return {
      keyId: this.razorpay.getPublicKeyId(),
      mode: this.razorpay.getMode(),
      razorpaySubscriptionId: local.providerSubscriptionId,
      localSubscriptionId: local.id,
      amountPaise: chargePaise,
      currency: plan.currency,
      planCode: plan.code,
      billingInterval: plan.billingInterval,
      trialDays,
      trialSummary: thenLabel,
      ctaLabel: `Start ${trialDays}-Day Free Trial`,
      name: process.env.PRODUCT_NAME || 'SPHEAR',
      description: `${plan.name} — ${trialDays}-day free trial`,
      prefill: {
        name: clinic.name,
        email: clinic.email || undefined,
        contact: clinic.phone || undefined,
      },
      notes: {
        clinicId: clinic.id,
        localSubscriptionId: local.id,
      },
      /** Frontend must not treat this as activation authority. */
      activation: 'webhook',
    };
  }

  async activateSubscription(clinicId: string, opts?: { actorId?: string; providerSubscriptionId?: string }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'ACTIVE');

    const now = new Date();
    const periodEnd = addMonths(now, billingPeriodMonths(sub.billingInterval));

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          startDate: sub.startDate || now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
          ...(opts?.providerSubscriptionId
            ? { providerSubscriptionId: opts.providerSubscriptionId, provider: 'razorpay' }
            : {}),
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.ACTIVATED,
        oldStatus: sub.status,
        newStatus: 'ACTIVE',
        metadata: { actorId: opts?.actorId || null },
      });
    });

    await this.notifyClinic(clinicId, 'activated');
    return this.getSubscription(clinicId);
  }

  async renewSubscription(clinicId: string, opts?: { actorId?: string }) {
    const sub = await this.requireLatest(clinicId);
    const from = sub.status;
    // Renew typically from ACTIVE (extend) or EXPIRED/CANCELLED via reactivate — here extend period
    if (from === 'EXPIRED' || from === 'CANCELLED') {
      return this.reactivateSubscription(clinicId, opts);
    }
    assertTransition(from, 'ACTIVE');

    const now = new Date();
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const periodEnd = addMonths(base, billingPeriodMonths(sub.billingInterval));

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.RENEWED,
        oldStatus: from,
        newStatus: 'ACTIVE',
        metadata: { actorId: opts?.actorId || null },
      });
    });

    return this.getSubscription(clinicId);
  }

  async cancelSubscription(
    clinicId: string,
    opts: { atPeriodEnd?: boolean; immediate?: boolean; actorId?: string } = {},
  ) {
    const atPeriodEnd = opts.immediate ? false : opts.atPeriodEnd !== false; // default period end
    const sub = await this.requireLatest(clinicId);

    if (atPeriodEnd) {
      if (!['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(sub.status)) {
        throw new BadRequestException('Cannot schedule cancel for this subscription status');
      }
      if (sub.provider === 'razorpay' && sub.providerSubscriptionId && this.razorpay.isConfigured()) {
        await this.razorpay.cancelSubscription(sub.providerSubscriptionId, true);
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: true },
        });
        await this.writeEvent(tx, {
          subscriptionId: sub.id,
          clinicId,
          eventType: SUBSCRIPTION_EVENT.CANCELLED,
          oldStatus: sub.status,
          newStatus: sub.status,
          metadata: { mode: 'at_period_end', actorId: opts.actorId || null },
        });
      });
      await this.notifyClinic(clinicId, 'cancelled');
      return this.getSubscription(clinicId);
    }

    assertTransition(sub.status, 'CANCELLED');
    if (sub.provider === 'razorpay' && sub.providerSubscriptionId && this.razorpay.isConfigured()) {
      await this.razorpay.cancelSubscription(sub.providerSubscriptionId, false);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELLED',
          cancelAtPeriodEnd: false,
          cancelledAt: now,
          endedAt: now,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.CANCELLED,
        oldStatus: sub.status,
        newStatus: 'CANCELLED',
        metadata: { mode: 'immediate', actorId: opts.actorId || null },
      });
    });

    await this.notifyClinic(clinicId, 'cancelled');
    return this.getSubscription(clinicId);
  }

  async expireSubscription(clinicId: string, opts?: { actorId?: string }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'EXPIRED');
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'EXPIRED',
          endedAt: now,
          cancelAtPeriodEnd: false,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.EXPIRED,
        oldStatus: sub.status,
        newStatus: 'EXPIRED',
        metadata: { actorId: opts?.actorId || null },
      });
    });

    // Never delete clinical data — only status change
    await this.notifyClinic(clinicId, 'expired');
    return this.getSubscription(clinicId);
  }

  async changePlan(clinicId: string, planCode: string, opts?: { actorId?: string }) {
    const sub = await this.requireLatest(clinicId);
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode.toUpperCase(), isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.id === sub.planId) throw new BadRequestException('Already on this plan');

    // MVP: single plan — still support immediate change for future tiers
    if (!['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(sub.status)) {
      throw new BadRequestException('Cannot change plan in current status');
    }

    const oldPlanId = sub.planId;
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planId: plan.id,
          amountPaise: planBillingAmountPaise(plan),
          currency: plan.currency,
          billingInterval: plan.billingInterval,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.PLAN_CHANGED,
        oldStatus: sub.status,
        newStatus: sub.status,
        metadata: {
          oldPlanId,
          newPlanId: plan.id,
          newPlanCode: plan.code,
          actorId: opts?.actorId || null,
        },
      });
    });

    return this.getSubscription(clinicId);
  }

  async markPaymentFailed(clinicId: string, opts?: { actorId?: string; reason?: string }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'PAYMENT_FAILED');
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAYMENT_FAILED' },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.PAYMENT_FAILED,
        oldStatus: sub.status,
        newStatus: 'PAYMENT_FAILED',
        metadata: { reason: opts?.reason || null, actorId: opts?.actorId || null },
      });
    });
    return this.getSubscription(clinicId);
  }

  async markPastDue(clinicId: string, opts?: { actorId?: string }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'PAST_DUE');
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.PAST_DUE,
        oldStatus: sub.status,
        newStatus: 'PAST_DUE',
        metadata: { actorId: opts?.actorId || null },
      });
    });
    return this.getSubscription(clinicId);
  }

  async enterGracePeriod(clinicId: string, opts?: { actorId?: string; days?: number }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'GRACE_PERIOD');
    const now = new Date();
    const days = opts?.days ?? GRACE_DAYS();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'GRACE_PERIOD',
          gracePeriodStart: now,
          gracePeriodEnd: addDays(now, days),
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.GRACE_PERIOD,
        oldStatus: sub.status,
        newStatus: 'GRACE_PERIOD',
        metadata: { days, actorId: opts?.actorId || null },
      });
    });
    return this.getSubscription(clinicId);
  }

  async reactivateSubscription(clinicId: string, opts?: { actorId?: string }) {
    const sub = await this.requireLatest(clinicId);
    assertTransition(sub.status, 'ACTIVE');
    const now = new Date();
    const periodMonths = billingPeriodMonths(sub.billingInterval);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(now, periodMonths),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId,
        eventType: SUBSCRIPTION_EVENT.REACTIVATED,
        oldStatus: sub.status,
        newStatus: 'ACTIVE',
        metadata: { actorId: opts?.actorId || null },
      });
    });
    return this.getSubscription(clinicId);
  }

  async checkAccess(clinicId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: { planFeatures: { include: { feature: true } } },
        },
      },
    });

    if (!sub) {
      return {
        allowed: false,
        status: null as SubscriptionStatus | null,
        reason: 'SUBSCRIPTION_REQUIRED',
        features: [] as string[],
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null as string | null,
      };
    }

    const features = sub.plan.planFeatures.map((pf) => pf.feature.code);
    const allowed = accessWhileCancelPending(
      sub.status,
      sub.cancelAtPeriodEnd,
      sub.currentPeriodEnd,
    );

    // Zero-day trial TRIALING without activate: still treat as allowed only if trialEnd in future
    let effectivelyAllowed = allowed;
    let trialExpired = false;
    if (sub.status === 'TRIALING' && sub.trialEnd && sub.trialEnd.getTime() <= Date.now()) {
      // Trial has expired — clinic must subscribe to continue
      effectivelyAllowed = false;
      trialExpired = true;
    }
    if (sub.status === 'TRIALING' && !sub.trialEnd) {
      // Created awaiting payment/activate — no HIS access until ACTIVE
      effectivelyAllowed = false;
    }

    return {
      allowed: effectivelyAllowed,
      status: sub.status,
      reason: effectivelyAllowed
        ? null
        : trialExpired
          ? 'TRIAL_EXPIRED'
          : sub.status === 'EXPIRED'
            ? 'SUBSCRIPTION_EXPIRED'
            : sub.status === 'CANCELLED'
              ? 'SUBSCRIPTION_CANCELLED'
              : !canAccessHis(sub.status) || sub.status === 'TRIALING'
                ? 'PAYMENT_REQUIRED'
                : 'SUBSCRIPTION_REQUIRED',
      features: effectivelyAllowed ? features : [],
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      trialEnd: sub.trialEnd?.toISOString() || null,
      accessAllowedStatuses: [...ACCESS_ALLOWED_STATUSES],
    };
  }

  async listPayments(clinicId: string) {
    return this.prisma.subscriptionPayment.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listInvoices(clinicId: string) {
    return this.prisma.subscriptionInvoice.findMany({
      where: { clinicId },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
    });
  }

  async getInvoice(clinicId: string, id: string) {
    const inv = await this.prisma.subscriptionInvoice.findFirst({
      where: { id, clinicId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  /** Assert caller may manage SaaS billing for the clinic. */
  assertClinicBillingAdmin(roles: string[] | undefined) {
    const ok = (roles || []).some((r) => r === 'ADMIN' || r === 'CLINIC_ADMIN');
    if (!ok) {
      throw new ForbiddenException('Only clinic admin can manage subscription');
    }
  }

  /** Count clinic users against plan seat limits (5 staff + 1 admin on Standard). */
  async getClinicSeatUsage(clinicId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    const plan = sub?.plan;
    const counts = await this.countClinicUserSeats(clinicId);
    return {
      maxStaffUsers: plan?.maxStaffUsers ?? 5,
      maxAdminUsers: plan?.maxAdminUsers ?? 1,
      usedStaffUsers: counts.staff,
      usedAdminUsers: counts.admin,
      remainingStaffUsers: Math.max(0, (plan?.maxStaffUsers ?? 5) - counts.staff),
      remainingAdminUsers: Math.max(0, (plan?.maxAdminUsers ?? 1) - counts.admin),
    };
  }

  /** Block new user when Standard seat caps would be exceeded. */
  async assertClinicUserSeatAvailable(
    clinicId: string,
    input: { staffType?: string; roleIds?: string[] },
  ) {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!sub?.plan) return;

    const adminRole = await this.prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const addingAdmin =
      isAdminStaffType(input.staffType) ||
      roleIdsIncludeAdmin(input.roleIds, adminRole?.id);

    const counts = await this.countClinicUserSeats(clinicId);
    const { maxStaffUsers, maxAdminUsers } = sub.plan;

    if (addingAdmin && counts.admin >= maxAdminUsers) {
      throw new SaasHttpException(
        SAAS_ERROR.SEAT_LIMIT_EXCEEDED,
        `Admin seat limit reached (${maxAdminUsers} included on your plan).`,
        HttpStatus.FORBIDDEN,
      );
    }
    if (!addingAdmin && counts.staff >= maxStaffUsers) {
      throw new SaasHttpException(
        SAAS_ERROR.SEAT_LIMIT_EXCEEDED,
        `Staff seat limit reached (${maxStaffUsers} included on your plan).`,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async countClinicUserSeats(clinicId: string) {
    const users = await this.prisma.user.findMany({
      where: { clinicId, status: { not: 'INACTIVE' }, isSystemSupport: false },
      include: { roles: { include: { role: true } } },
    });
    let admin = 0;
    let staff = 0;
    for (const user of users) {
      const isAdmin =
        user.staffType === 'ADMIN' ||
        user.roles.some((ur) => ur.role.name === 'ADMIN');
      if (isAdmin) admin += 1;
      else staff += 1;
    }
    return { admin, staff, total: users.length };
  }

  /**
   * Webhook: first successful charge → ACTIVE.
   * Idempotent if already ACTIVE.
   */
  async applyProviderActivated(
    providerSubscriptionId: string,
    opts?: {
      providerPaymentId?: string;
      amountPaise?: number;
      currency?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const sub = await this.requireByProviderSubscriptionId(providerSubscriptionId);
    if (sub.status === 'ACTIVE') {
      await this.recordProviderPayment(sub, opts, 'CAPTURED');
      return this.getSubscription(sub.clinicId);
    }
    assertTransition(sub.status, 'ACTIVE');
    const now = new Date();
    const periodMonths = billingPeriodMonths(sub.billingInterval);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          provider: 'razorpay',
          providerSubscriptionId,
          startDate: sub.startDate || now,
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(now, periodMonths),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId: sub.clinicId,
        eventType: SUBSCRIPTION_EVENT.ACTIVATED,
        oldStatus: sub.status,
        newStatus: 'ACTIVE',
        metadata: { ...(opts?.metadata || {}), providerSubscriptionId },
      });
      await this.upsertPaymentTx(tx, sub, opts, 'CAPTURED');
      await this.upsertInvoiceTx(tx, sub, opts);
    });
    await this.notifyClinic(sub.clinicId, 'activated', opts?.amountPaise);
    return this.getSubscription(sub.clinicId);
  }

  /** Webhook: recurring charge succeeded → renew period + payment. */
  async applyProviderCharged(
    providerSubscriptionId: string,
    opts?: {
      providerPaymentId?: string;
      amountPaise?: number;
      currency?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const sub = await this.requireByProviderSubscriptionId(providerSubscriptionId);
    if (sub.status === 'TRIALING') {
      return this.applyProviderActivated(providerSubscriptionId, opts);
    }

    const now = new Date();
    const from = sub.status;
    if (from !== 'ACTIVE') {
      assertTransition(from, 'ACTIVE');
    }

    const periodMonths = billingPeriodMonths(sub.billingInterval);
    const base =
      sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const periodEnd = addMonths(base, periodMonths);

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId: sub.clinicId,
        eventType: from === 'ACTIVE' ? SUBSCRIPTION_EVENT.RENEWED : SUBSCRIPTION_EVENT.ACTIVATED,
        oldStatus: from,
        newStatus: 'ACTIVE',
        metadata: { ...(opts?.metadata || {}), providerSubscriptionId },
      });
      await this.upsertPaymentTx(tx, sub, opts, 'CAPTURED');
      await this.upsertInvoiceTx(tx, sub, opts);
    });
    await this.notifyClinic(sub.clinicId, 'renewed', opts?.amountPaise);
    return this.getSubscription(sub.clinicId);
  }

  /** Webhook: pending / payment.failed → PAYMENT_FAILED then GRACE_PERIOD. */
  async applyProviderPaymentFailed(
    providerSubscriptionId: string,
    opts?: {
      providerPaymentId?: string;
      amountPaise?: number;
      currency?: string;
      failureReason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const sub = await this.requireByProviderSubscriptionId(providerSubscriptionId);
    const now = new Date();
    const graceDays = GRACE_DAYS();
    const graceEnd = addDays(now, graceDays);

    await this.prisma.$transaction(async (tx) => {
      const target: SubscriptionStatus =
        sub.status === 'GRACE_PERIOD' ? 'GRACE_PERIOD' : 'PAYMENT_FAILED';
      if (sub.status !== target) {
        assertTransition(sub.status, target);
      }
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: target === 'PAYMENT_FAILED' ? 'PAYMENT_FAILED' : 'GRACE_PERIOD',
          ...(target === 'PAYMENT_FAILED'
            ? {}
            : { gracePeriodStart: sub.gracePeriodStart || now, gracePeriodEnd: graceEnd }),
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId: sub.clinicId,
        eventType: SUBSCRIPTION_EVENT.PAYMENT_FAILED,
        oldStatus: sub.status,
        newStatus: target === 'PAYMENT_FAILED' ? 'PAYMENT_FAILED' : 'GRACE_PERIOD',
        metadata: {
          ...(opts?.metadata || {}),
          failureReason: opts?.failureReason || null,
        },
      });

      // Immediately enter grace so clinic keeps access (5-day policy)
      if (target === 'PAYMENT_FAILED') {
        assertTransition('PAYMENT_FAILED', 'GRACE_PERIOD');
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'GRACE_PERIOD',
            gracePeriodStart: now,
            gracePeriodEnd: graceEnd,
          },
        });
        await this.writeEvent(tx, {
          subscriptionId: sub.id,
          clinicId: sub.clinicId,
          eventType: SUBSCRIPTION_EVENT.GRACE_PERIOD,
          oldStatus: 'PAYMENT_FAILED',
          newStatus: 'GRACE_PERIOD',
          metadata: { days: graceDays },
        });
      }

      await this.upsertPaymentTx(tx, sub, { ...opts, failureReason: opts?.failureReason }, 'FAILED');
    });
    await this.notifyClinic(sub.clinicId, 'payment_failed');
    return this.getSubscription(sub.clinicId);
  }

  /** Webhook: halted after retries exhausted → SUSPENDED (data retained). */
  async applyProviderHalted(
    providerSubscriptionId: string,
    opts?: { reason?: string; metadata?: Record<string, unknown> },
  ) {
    const sub = await this.requireByProviderSubscriptionId(providerSubscriptionId);
    if (sub.status === 'SUSPENDED' || sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
      return this.getSubscription(sub.clinicId);
    }
    assertTransition(sub.status, 'SUSPENDED');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'SUSPENDED', endedAt: now },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId: sub.clinicId,
        eventType: SUBSCRIPTION_EVENT.SUSPENDED,
        oldStatus: sub.status,
        newStatus: 'SUSPENDED',
        metadata: { ...(opts?.metadata || {}), reason: opts?.reason || 'halted' },
      });
    });
    return this.getSubscription(sub.clinicId);
  }

  /** Webhook: cancelled or completed cycles → CANCELLED / EXPIRED. */
  async applyProviderCancelled(
    providerSubscriptionId: string,
    opts?: { completed?: boolean; metadata?: Record<string, unknown> },
  ) {
    const sub = await this.requireByProviderSubscriptionId(providerSubscriptionId);
    const target: SubscriptionStatus = opts?.completed ? 'EXPIRED' : 'CANCELLED';
    if (sub.status === target) {
      return this.getSubscription(sub.clinicId);
    }
    assertTransition(sub.status, target);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: target,
          cancelAtPeriodEnd: false,
          cancelledAt: target === 'CANCELLED' ? now : sub.cancelledAt,
          endedAt: now,
        },
      });
      await this.writeEvent(tx, {
        subscriptionId: sub.id,
        clinicId: sub.clinicId,
        eventType:
          target === 'EXPIRED' ? SUBSCRIPTION_EVENT.EXPIRED : SUBSCRIPTION_EVENT.CANCELLED,
        oldStatus: sub.status,
        newStatus: target,
        metadata: opts?.metadata || {},
      });
    });
    return this.getSubscription(sub.clinicId);
  }

  private async requireByProviderSubscriptionId(providerSubscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(
        `No local subscription for provider id ${providerSubscriptionId}`,
      );
    }
    return sub;
  }

  private async recordProviderPayment(
    sub: Subscription,
    opts:
      | {
          providerPaymentId?: string;
          amountPaise?: number;
          currency?: string;
          failureReason?: string;
        }
      | undefined,
    status: 'CAPTURED' | 'FAILED' | 'AUTHORIZED',
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.upsertPaymentTx(tx, sub, opts, status);
    });
  }

  private async upsertPaymentTx(
    tx: Prisma.TransactionClient,
    sub: Subscription,
    opts:
      | {
          providerPaymentId?: string;
          amountPaise?: number;
          currency?: string;
          failureReason?: string;
        }
      | undefined,
    status: 'CAPTURED' | 'FAILED' | 'AUTHORIZED',
  ) {
    if (!opts?.providerPaymentId) return;
    const existing = await tx.subscriptionPayment.findFirst({
      where: { providerPaymentId: opts.providerPaymentId },
    });
    if (existing) {
      await tx.subscriptionPayment.update({
        where: { id: existing.id },
        data: {
          status,
          failureReason: opts.failureReason || existing.failureReason,
          paidAt: status === 'CAPTURED' || status === 'AUTHORIZED' ? existing.paidAt || new Date() : existing.paidAt,
        },
      });
      return;
    }
    await tx.subscriptionPayment.create({
      data: {
        clinicId: sub.clinicId,
        subscriptionId: sub.id,
        provider: 'razorpay',
        providerPaymentId: opts.providerPaymentId,
        amountPaise: opts.amountPaise ?? sub.amountPaise,
        currency: opts.currency || sub.currency,
        status,
        failureReason: opts.failureReason || null,
        paidAt: status === 'CAPTURED' || status === 'AUTHORIZED' ? new Date() : null,
      },
    });
  }

  private async upsertInvoiceTx(
    tx: Prisma.TransactionClient,
    sub: Subscription,
    opts?: { providerPaymentId?: string; amountPaise?: number; currency?: string },
  ) {
    if (!opts?.providerPaymentId) return;
    const invoiceNumber = `SAAS-${opts.providerPaymentId}`;
    const existing = await tx.subscriptionInvoice.findFirst({
      where: { clinicId: sub.clinicId, invoiceNumber },
    });
    if (existing) return;
    const amount = opts.amountPaise ?? sub.amountPaise;
    await tx.subscriptionInvoice.create({
      data: {
        clinicId: sub.clinicId,
        subscriptionId: sub.id,
        invoiceNumber,
        amountPaise: amount,
        taxAmountPaise: 0,
        discountAmountPaise: 0,
        totalAmountPaise: amount,
        currency: opts.currency || sub.currency,
        status: 'PAID',
        invoiceDate: new Date(),
        paidAt: new Date(),
        providerInvoiceId: opts.providerPaymentId,
      },
    });
  }

  private async notifyClinic(
    clinicId: string,
    kind: 'activated' | 'renewed' | 'payment_failed' | 'cancelled' | 'expired',
    amountPaise?: number,
  ) {
    try {
      const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
      const sub = await this.prisma.subscription.findFirst({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      if (!clinic?.email || !sub) return;
      const ctx = {
        to: clinic.email,
        clinicName: clinic.name,
        planName: sub.plan.name,
        periodEnd: sub.currentPeriodEnd?.toISOString() || null,
        amountDisplay:
          typeof amountPaise === 'number'
            ? `₹${(amountPaise / 100).toLocaleString('en-IN')}`
            : undefined,
      };
      if (kind === 'activated') await this.mail.paymentSucceeded(ctx);
      else if (kind === 'renewed') await this.mail.renewed(ctx);
      else if (kind === 'payment_failed') await this.mail.paymentFailed(ctx);
      else if (kind === 'cancelled') await this.mail.cancelled(ctx);
      else if (kind === 'expired') await this.mail.expired(ctx);
    } catch (err) {
      this.logger.warn(
        `notifyClinic(${kind}) failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async requireLatest(clinicId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('No subscription for this clinic');
    return sub;
  }

  private async writeEvent(
    tx: Prisma.TransactionClient,
    data: {
      subscriptionId: string;
      clinicId: string;
      eventType: string;
      oldStatus: SubscriptionStatus | null;
      newStatus: SubscriptionStatus;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: data.subscriptionId,
        clinicId: data.clinicId,
        eventType: data.eventType,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  private mapPlan(plan: any) {
    const billingAmountPaise = planBillingAmountPaise(plan);
    const monthlyComparePaise = 180_000;
    const yearlySavingsPaise =
      plan.billingInterval === 'YEARLY'
        ? Math.max(0, (monthlyComparePaise - plan.monthlyPricePaise) * 12)
        : 0;
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPricePaise: plan.monthlyPricePaise,
      monthlyPriceDisplay: formatInrPaise(plan.monthlyPricePaise),
      billingAmountPaise,
      billingAmountDisplay: formatInrPaise(billingAmountPaise),
      billingInterval: plan.billingInterval,
      billingIntervalLabel: plan.billingInterval === 'YEARLY' ? 'year' : 'month',
      yearlySavingsDisplay:
        yearlySavingsPaise > 0 ? formatInrPaise(yearlySavingsPaise) : undefined,
      maxStaffUsers: plan.maxStaffUsers,
      maxAdminUsers: plan.maxAdminUsers,
      seatSummary: `${plan.maxStaffUsers} staff + ${plan.maxAdminUsers} admin`,
      trialDays: plan.trialDays,
      isPopular:
        plan.code === (process.env.SAAS_DEFAULT_PLAN_CODE || STANDARD_MONTHLY_CODE) &&
        plan.billingInterval === 'MONTHLY',
      features: (plan.planFeatures || []).map((pf: any) => ({
        code: pf.feature.code,
        name: pf.feature.name,
        description: pf.feature.description,
        module: pf.feature.module,
      })),
      currency: plan.currency,
    };
  }

  private mapSubscription(sub: any) {
    return {
      id: sub.id,
      clinicId: sub.clinicId,
      status: sub.status,
      amountPaise: sub.amountPaise,
      currency: sub.currency,
      billingInterval: sub.billingInterval,
      provider: sub.provider,
      providerCustomerId: sub.providerCustomerId,
      providerSubscriptionId: sub.providerSubscriptionId,
      startDate: sub.startDate,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialStart: sub.trialStart,
      trialEnd: sub.trialEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt,
      endedAt: sub.endedAt,
      gracePeriodStart: sub.gracePeriodStart,
      gracePeriodEnd: sub.gracePeriodEnd,
      plan: sub.plan ? this.mapPlan(sub.plan) : undefined,
    };
  }
}
