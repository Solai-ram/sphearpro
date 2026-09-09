import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import { evaluateSubscriptionGate } from '../../common/guards/subscription.guard';

function signPayment(paymentId: string, subscriptionId: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
}

function baseSub(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'sub_local_1',
    clinicId: 'clinic_a',
    planId: 'plan_1',
    status: 'TRIALING',
    amountPaise: 230000,
    currency: 'INR',
    billingInterval: 'MONTHLY',
    provider: 'razorpay',
    providerCustomerId: 'cust_1',
    providerSubscriptionId: 'sub_rzp_1',
    startDate: now,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
    trialStart: null,
    trialEnd: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    endedAt: null,
    gracePeriodStart: null,
    gracePeriodEnd: null,
    plan: {
      id: 'plan_1',
      code: 'STANDARD',
      name: 'Standard',
      description: null,
      monthlyPricePaise: 230000,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      maxStaffUsers: 10,
      maxAdminUsers: 1,
      trialDays: 0,
      planFeatures: [],
    },
    ...overrides,
  };
}

describe('Phase 12 — subscription lifecycle matrix', () => {
  const prev = { ...process.env };
  let prisma: any;
  let mail: any;
  let razorpay: RazorpayService;
  let svc: SubscriptionService;
  let subRow: ReturnType<typeof baseSub>;

  beforeEach(() => {
    process.env = { ...prev };
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'key_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    process.env.SUBSCRIPTION_GRACE_DAYS = '5';
    process.env.SAAS_DEFAULT_PLAN_CODE = 'STANDARD';

    subRow = baseSub();

    prisma = {
      patient: { deleteMany: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
      clinic: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'clinic_a',
          name: 'Sunrise',
          email: 'clinic@example.com',
          phone: null,
          slug: 'sunrise',
        }),
      },
      subscription: {
        findFirst: vi.fn(async () => subRow),
        findUnique: vi.fn(async () => subRow),
        update: vi.fn(async ({ data }: any) => {
          Object.assign(subRow, data);
          return subRow;
        }),
        create: vi.fn(),
      },
      subscriptionEvent: { create: vi.fn().mockResolvedValue({}) },
      subscriptionPayment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      subscriptionInvoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      subscriptionPlan: {
        findFirst: vi.fn().mockResolvedValue(subRow.plan),
      },
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
    };

    mail = {
      paymentSucceeded: vi.fn(),
      renewed: vi.fn(),
      paymentFailed: vi.fn(),
      cancelled: vi.fn(),
      expired: vi.fn(),
    };

    razorpay = new RazorpayService();
    svc = new SubscriptionService(prisma as any, razorpay, mail as any);
  });

  it('doctor / non-admin cannot manage subscription', () => {
    expect(() => svc.assertClinicBillingAdmin(['DOCTOR'])).toThrow(ForbiddenException);
    expect(() => svc.assertClinicBillingAdmin(['BILLING'])).toThrow(ForbiddenException);
    expect(() => svc.assertClinicBillingAdmin(['ADMIN'])).not.toThrow();
  });

  it('frontend confirmCheckout does not activate (webhook is authority)', async () => {
    const paymentId = 'pay_confirm_1';
    const subscriptionId = 'sub_rzp_1';
    const signature = signPayment(paymentId, subscriptionId, 'key_secret');

    const result = await svc.confirmCheckout('clinic_a', {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    });

    expect(result.activated).toBe(false);
    expect(result.awaitingWebhook).toBe(true);
    expect(subRow.status).toBe('TRIALING');
    expect(prisma.subscriptionPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AUTHORIZED' }),
      }),
    );
  });

  it('confirmCheckout rejects mismatched provider subscription id (clinic_id tamper)', async () => {
    const { SaasHttpException, SAAS_ERROR } = await import('./razorpay.errors');
    try {
      await svc.confirmCheckout('clinic_a', {
        razorpay_payment_id: 'pay_x',
        razorpay_subscription_id: 'sub_other_clinic',
        razorpay_signature: 'x',
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SaasHttpException);
      const body = (err as InstanceType<typeof SaasHttpException>).getResponse() as any;
      expect(body.error.code).toBe(SAAS_ERROR.INVALID_SUBSCRIPTION);
      expect(body.error.message).toMatch(/does not match/i);
    }
  });

  it('successful payment webhook activates TRIALING → ACTIVE', async () => {
    const mapped = await svc.applyProviderActivated('sub_rzp_1', {
      providerPaymentId: 'pay_act_1',
      amountPaise: 180000,
    });
    expect(mapped.status).toBe('ACTIVE');
    expect(mail.paymentSucceeded).toHaveBeenCalled();
    expect(evaluateSubscriptionGate({ status: 'ACTIVE' }).allowed).toBe(true);
  });

  it('renewal charged webhook keeps ACTIVE and advances period', async () => {
    subRow.status = 'ACTIVE';
    const beforeEnd = subRow.currentPeriodEnd as Date;
    await svc.applyProviderCharged('sub_rzp_1', {
      providerPaymentId: 'pay_renew_1',
      amountPaise: 180000,
    });
    expect(subRow.status).toBe('ACTIVE');
    expect((subRow.currentPeriodEnd as Date).getTime()).toBeGreaterThan(beforeEnd.getTime());
    expect(mail.renewed).toHaveBeenCalled();
  });

  it('failed payment → GRACE_PERIOD (access retained)', async () => {
    subRow.status = 'ACTIVE';
    await svc.applyProviderPaymentFailed('sub_rzp_1', {
      providerPaymentId: 'pay_fail_1',
      failureReason: 'insufficient_funds',
    });
    expect(subRow.status).toBe('GRACE_PERIOD');
    expect(subRow.gracePeriodEnd).toBeTruthy();
    expect(evaluateSubscriptionGate({ status: 'GRACE_PERIOD' }).allowed).toBe(true);
    expect(mail.paymentFailed).toHaveBeenCalled();
  });

  it('cancel at period end keeps status and sets flag', async () => {
    subRow.status = 'ACTIVE';
    vi.spyOn(razorpay, 'isConfigured').mockReturnValue(false);
    await svc.cancelSubscription('clinic_a', { atPeriodEnd: true });
    expect(subRow.cancelAtPeriodEnd).toBe(true);
    expect(subRow.status).toBe('ACTIVE');
    expect(
      evaluateSubscriptionGate({
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subRow.currentPeriodEnd as Date,
      }).allowed,
    ).toBe(true);
  });

  it('immediate cancel → CANCELLED and blocks HIS access', async () => {
    subRow.status = 'ACTIVE';
    vi.spyOn(razorpay, 'isConfigured').mockReturnValue(false);
    await svc.cancelSubscription('clinic_a', { immediate: true });
    expect(subRow.status).toBe('CANCELLED');
    expect(evaluateSubscriptionGate({ status: 'CANCELLED' }).allowed).toBe(false);
  });

  it('expire blocks HIS APIs but never deletes clinical rows', async () => {
    subRow.status = 'GRACE_PERIOD';
    await svc.expireSubscription('clinic_a');
    expect(subRow.status).toBe('EXPIRED');
    expect(evaluateSubscriptionGate({ status: 'EXPIRED' }).allowed).toBe(false);
    expect(prisma.patient.delete).not.toHaveBeenCalled();
    expect(prisma.patient.deleteMany).not.toHaveBeenCalled();
    expect(mail.expired).toHaveBeenCalled();
  });

  it('grace → expire → renew restores access', async () => {
    subRow.status = 'EXPIRED';
    await svc.applyProviderCharged('sub_rzp_1', {
      providerPaymentId: 'pay_restore_1',
      amountPaise: 180000,
    });
    expect(subRow.status).toBe('ACTIVE');
    expect(evaluateSubscriptionGate({ status: 'ACTIVE' }).allowed).toBe(true);
  });

  it('MVP single plan: changePlan to same code rejects', async () => {
    subRow.status = 'ACTIVE';
    await expect(svc.changePlan('clinic_a', 'STANDARD')).rejects.toThrow(/Already on this plan/);
  });

  it('SaaS invoice lookup is clinic-scoped', async () => {
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    await expect(svc.getInvoice('clinic_a', 'inv_other')).rejects.toThrow(/Invoice not found/);
    expect(prisma.subscriptionInvoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'inv_other', clinicId: 'clinic_a' },
    });
  });
});
