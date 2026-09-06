import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { SubscriptionBillingInterval } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { SAAS_ERROR, SaasHttpException } from './razorpay.errors';

export type RazorpayCustomerInput = {
  name: string;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string>;
};

export type RazorpaySubscriptionCreateInput = {
  planId: string;
  totalCount: number;
  customerId?: string;
  customerNotify?: boolean;
  notes?: Record<string, string>;
  expireBy?: number;
  /** Unix timestamp (seconds). First plan charge starts at this time — use for free trial. */
  startAt?: number;
};

export type RazorpayOrderCreateInput = {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

/** Minimal surface we use — allows injecting a mock in tests. */
export type RazorpayClientLike = {
  customers: {
    create: (body: Record<string, unknown>) => Promise<{ id: string; [k: string]: unknown }>;
  };
  orders: {
    create: (body: Record<string, unknown>) => Promise<{
      id: string;
      amount: number;
      currency: string;
      receipt?: string | null;
      status?: string;
      [k: string]: unknown;
    }>;
  };
  subscriptions: {
    create: (body: Record<string, unknown>) => Promise<{ id: string; status?: string; [k: string]: unknown }>;
    fetch: (id: string) => Promise<{ id: string; status?: string; [k: string]: unknown }>;
    cancel: (id: string, cancelAtCycleEnd?: boolean) => Promise<{ id: string; status?: string; [k: string]: unknown }>;
    pause: (id: string, pauseAt?: string) => Promise<{ id: string; status?: string; [k: string]: unknown }>;
    resume: (id: string, resumeAt?: string) => Promise<{ id: string; status?: string; [k: string]: unknown }>;
  };
};

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client: RazorpayClientLike | null = null;

  /** Test / live is inferred from key id prefix (`rzp_test_` vs `rzp_live_`). */
  getMode(): 'test' | 'live' | 'unconfigured' {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    if (!keyId) return 'unconfigured';
    if (keyId.startsWith('rzp_live_')) return 'live';
    return 'test';
  }

  isConfigured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  /** Public key id only — safe to send to the browser for Checkout. */
  getPublicKeyId(): string {
    this.assertConfigured();
    return process.env.RAZORPAY_KEY_ID as string;
  }

  /** Resolve monthly/yearly Razorpay Plan IDs (new names + legacy fallbacks). */
  private resolveProviderPlanId(billingInterval: SubscriptionBillingInterval): string {
    if (billingInterval === 'YEARLY') {
      return (
        process.env.RAZORPAY_YEARLY_PLAN_ID ||
        process.env.RAZORPAY_PLAN_ID_YEARLY ||
        ''
      );
    }
    return process.env.RAZORPAY_MONTHLY_PLAN_ID || process.env.RAZORPAY_PLAN_ID || '';
  }

  /** True when a Razorpay Subscription Plan id is configured for this interval. */
  hasProviderPlanId(billingInterval: SubscriptionBillingInterval = 'MONTHLY'): boolean {
    return Boolean(this.resolveProviderPlanId(billingInterval));
  }

  getProviderPlanId(billingInterval: SubscriptionBillingInterval = 'MONTHLY'): string {
    const planId = this.resolveProviderPlanId(billingInterval);
    if (!planId) {
      const hint =
        billingInterval === 'YEARLY'
          ? 'Create a yearly plan in Razorpay Dashboard (₹18,000/yr) and set RAZORPAY_YEARLY_PLAN_ID.'
          : 'Create a monthly plan in Razorpay Dashboard (₹1,800/mo) and set RAZORPAY_MONTHLY_PLAN_ID.';
      throw new SaasHttpException(SAAS_ERROR.RAZORPAY_PLAN_MISSING, hint, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return planId;
  }

  /** Free-trial length before first Razorpay charge (default 7 days). */
  getCheckoutTrialDays(): number {
    const n = Number(process.env.RAZORPAY_TRIAL_DAYS || process.env.SUBSCRIPTION_TRIAL_DAYS || 7);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 7;
  }

  /** Unix seconds for subscription `start_at` = now + trial days (no plan charge until then). */
  getTrialStartAtUnix(trialDays?: number): number {
    const days = trialDays ?? this.getCheckoutTrialDays();
    return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  }

  getSubscriptionTotalCount(billingInterval: SubscriptionBillingInterval = 'MONTHLY'): number {
    if (billingInterval === 'YEARLY') {
      const n = Number(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT_YEARLY || 10);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
    }
    const n = Number(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT || 120);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
  }

  /** Inject a mock client in unit tests. */
  setClientForTests(client: RazorpayClientLike | null) {
    this.client = client;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new SaasHttpException(
        SAAS_ERROR.RAZORPAY_NOT_CONFIGURED,
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys for local).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private getClient(): RazorpayClientLike {
    this.assertConfigured();
    if (this.client) return this.client;
    this.client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    }) as unknown as RazorpayClientLike;
    return this.client;
  }

  private wrapProviderError(action: string, err: unknown): never {
    const anyErr = err as {
      error?: { description?: string; code?: string };
      message?: string;
      statusCode?: number;
      status?: number;
    };
    const message =
      anyErr?.error?.description ||
      anyErr?.message ||
      `Razorpay ${action} failed`;
    const statusCode = anyErr?.statusCode ?? anyErr?.status;
    this.logger.warn(`Razorpay ${action} failed: ${message}`);
    if (statusCode === 401 || statusCode === 403) {
      throw new SaasHttpException(SAAS_ERROR.RAZORPAY_PROVIDER_ERROR, message, HttpStatus.UNAUTHORIZED);
    }
    throw new SaasHttpException(
      SAAS_ERROR.RAZORPAY_PROVIDER_ERROR,
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Razorpay Standard Checkout — create a one-time order.
   * Amount must be in paise (minimum 100).
   */
  async createOrder(input: RazorpayOrderCreateInput) {
    const amount = Math.floor(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 100) {
      throw new SaasHttpException(
        SAAS_ERROR.PAYMENT_REQUIRED,
        'Amount must be at least 100 paise',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const order = await this.getClient().orders.create({
        amount,
        currency: (input.currency || 'INR').toUpperCase(),
        receipt: input.receipt || `rcpt_${Date.now()}`,
        notes: input.notes || {},
      });
      this.logger.log(`Created Razorpay order ${order.id} amount=${order.amount}`);
      return order;
    } catch (err) {
      this.wrapProviderError('createOrder', err);
    }
  }

  async createCustomer(input: RazorpayCustomerInput) {
    try {
      const body: Record<string, unknown> = {
        name: input.name,
        notes: input.notes || {},
      };
      if (input.email) body.email = input.email;
      if (input.contact) body.contact = input.contact;
      const customer = await this.getClient().customers.create(body);
      this.logger.log(`Created Razorpay customer ${customer.id}`);
      return customer;
    } catch (err) {
      this.wrapProviderError('createCustomer', err);
    }
  }

  async createSubscription(input: RazorpaySubscriptionCreateInput) {
    try {
      const body: Record<string, unknown> = {
        plan_id: input.planId,
        total_count: input.totalCount,
        customer_notify: input.customerNotify === false ? 0 : 1,
        notes: input.notes || {},
      };
      if (input.customerId) body.customer_id = input.customerId;
      if (input.expireBy) body.expire_by = input.expireBy;
      if (input.startAt) body.start_at = input.startAt;
      const sub = await this.getClient().subscriptions.create(body);
      this.logger.log(
        `Created Razorpay subscription ${sub.id} status=${sub.status || 'unknown'} start_at=${input.startAt || 'immediate'}`,
      );
      return sub;
    } catch (err) {
      this.wrapProviderError('createSubscription', err);
    }
  }

  async fetchSubscription(providerSubscriptionId: string) {
    try {
      return await this.getClient().subscriptions.fetch(providerSubscriptionId);
    } catch (err) {
      this.wrapProviderError('fetchSubscription', err);
    }
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtCycleEnd = true) {
    try {
      const sub = await this.getClient().subscriptions.cancel(
        providerSubscriptionId,
        cancelAtCycleEnd,
      );
      this.logger.log(
        `Cancelled Razorpay subscription ${providerSubscriptionId} atCycleEnd=${cancelAtCycleEnd}`,
      );
      return sub;
    } catch (err) {
      this.wrapProviderError('cancelSubscription', err);
    }
  }

  async pauseSubscription(providerSubscriptionId: string, pauseAt: 'now' = 'now') {
    try {
      return await this.getClient().subscriptions.pause(providerSubscriptionId, pauseAt);
    } catch (err) {
      this.wrapProviderError('pauseSubscription', err);
    }
  }

  async resumeSubscription(providerSubscriptionId: string, resumeAt: 'now' = 'now') {
    try {
      return await this.getClient().subscriptions.resume(providerSubscriptionId, resumeAt);
    } catch (err) {
      this.wrapProviderError('resumeSubscription', err);
    }
  }

  /**
   * Verify Checkout payment signature for one-time orders:
   * HMAC_SHA256(order_id|payment_id, key_secret)
   */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    this.assertConfigured();
    const secret = process.env.RAZORPAY_KEY_SECRET as string;
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return equalHex(expected, signature);
  }

  /**
   * Verify subscription Checkout handler signature:
   * HMAC_SHA256(payment_id|subscription_id, key_secret)
   */
  verifySubscriptionPayment(
    paymentId: string,
    subscriptionId: string,
    signature: string,
  ): boolean {
    this.assertConfigured();
    const secret = process.env.RAZORPAY_KEY_SECRET as string;
    const expected = createHmac('sha256', secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest('hex');
    return equalHex(expected, signature);
  }

  /**
   * Verify webhook signature (Phase 6 will use this on the raw body).
   * HMAC_SHA256(rawBody, webhook_secret)
   */
  verifyWebhook(rawBody: string | Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new SaasHttpException(
        SAAS_ERROR.RAZORPAY_NOT_CONFIGURED,
        'RAZORPAY_WEBHOOK_SECRET is not set',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return equalHex(expected, signature);
  }
}

function equalHex(expected: string, actual: string): boolean {
  if (!expected || !actual || expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
  } catch {
    return false;
  }
}
