import { describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import { createMockPrisma } from '../../test/mock-prisma';

function service(prisma: any) {
  return new SubscriptionService(prisma, {} as RazorpayService, { subscriptionCreated: vi.fn() } as any);
}

describe('SubscriptionService.checkAccess', () => {
  it('requires a subscription when none exists', async () => {
    const prisma = createMockPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const result = await service(prisma).checkAccess('clinic_a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SUBSCRIPTION_REQUIRED');
    expect(result.features).toEqual([]);
  });

  it('allows ACTIVE with plan features', async () => {
    const prisma = createMockPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      trialEnd: null,
      plan: { planFeatures: [{ feature: { code: 'PATIENT_MANAGEMENT' } }] },
    });
    const result = await service(prisma).checkAccess('clinic_a');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.features).toContain('PATIENT_MANAGEMENT');
  });

  it('returns TRIAL_EXPIRED when trialEnd is in the past', async () => {
    const prisma = createMockPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      status: 'TRIALING',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      trialEnd: new Date(Date.now() - 1000),
      plan: { planFeatures: [{ feature: { code: 'PATIENT_MANAGEMENT' } }] },
    });
    const result = await service(prisma).checkAccess('clinic_a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TRIAL_EXPIRED');
    expect(result.features).toEqual([]);
  });

  it('blocks TRIALING without trialEnd (awaiting payment)', async () => {
    const prisma = createMockPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      status: 'TRIALING',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      plan: { planFeatures: [] },
    });
    const result = await service(prisma).checkAccess('clinic_a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PAYMENT_REQUIRED');
  });

  it('maps CANCELLED and EXPIRED reasons', async () => {
    const prisma = createMockPrisma();
    prisma.subscription.findFirst.mockResolvedValueOnce({
      status: 'CANCELLED',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      plan: { planFeatures: [] },
    });
    expect((await service(prisma).checkAccess('c')).reason).toBe('SUBSCRIPTION_CANCELLED');

    prisma.subscription.findFirst.mockResolvedValueOnce({
      status: 'EXPIRED',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      plan: { planFeatures: [] },
    });
    expect((await service(prisma).checkAccess('c')).reason).toBe('SUBSCRIPTION_EXPIRED');
  });
});

describe('SubscriptionService.createSubscription (mocked)', () => {
  it('creates TRIALING with a 7-day trial when plan.trialDays is 0', async () => {
    const prisma = createMockPrisma();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan_1',
      code: 'STANDARD',
      name: 'Standard',
      trialDays: 0,
      monthlyPricePaise: 180_000,
      currency: 'INR',
      billingInterval: 'MONTHLY',
    });
    prisma.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub_1',
        status: 'TRIALING',
        trialEnd: new Date(Date.now() + 7 * 86_400_000),
        plan: { planFeatures: [] },
      });
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        subscription: {
          create: vi.fn().mockResolvedValue({
            id: 'sub_1',
            status: 'TRIALING',
            plan: { code: 'STANDARD' },
          }),
        },
        subscriptionEvent: { create: vi.fn() },
      }),
    );
    prisma.clinic.findUnique.mockResolvedValue({ email: 'a@x.com', name: 'Sunrise' });

    const mail = { subscriptionCreated: vi.fn() };
    const svc = new SubscriptionService(prisma, {} as RazorpayService, mail as any);
    await svc.createSubscription('clinic_a', 'STANDARD', 'actor_1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mail.subscriptionCreated).toHaveBeenCalled();
  });

  it('rejects a second in-flight subscription', async () => {
    const prisma = createMockPrisma();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan_1',
      code: 'STANDARD',
      trialDays: 7,
      monthlyPricePaise: 180_000,
      currency: 'INR',
      billingInterval: 'MONTHLY',
    });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'existing', status: 'TRIALING' });
    await expect(service(prisma).createSubscription('clinic_a', 'STANDARD')).rejects.toThrow(
      /already has an active/,
    );
  });
});
