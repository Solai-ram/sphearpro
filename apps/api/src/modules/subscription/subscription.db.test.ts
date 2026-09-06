import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { SubscriptionJobsService } from './subscription-jobs.service';
import { disconnectTestPrisma, getTestPrisma, truncateAll, describeDb } from '../../test/prisma-test';
import { createTestTenant, ensureStandardPlan } from '../../test/tenant-factory';

const mail = {
  subscriptionCreated: vi.fn(),
  expired: vi.fn().mockResolvedValue(undefined),
  paymentFailed: vi.fn(),
  paymentSucceeded: vi.fn(),
  renewed: vi.fn(),
  cancelled: vi.fn(),
  expiryReminder: vi.fn(),
};

describeDb('SubscriptionService (database)', () => {
  let prisma: PrismaClient | null;

  beforeAll(async () => {
    prisma = await getTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await truncateAll(prisma);
  });

  it('creates a 7-day TRIALING subscription and allows access until trialEnd', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    await ensureStandardPlan(prisma);
    const svc = new SubscriptionService(prisma, {} as any, mail as any);
    await svc.createSubscription(tenant.clinic.id, 'STANDARD', tenant.adminUser.id);
    const access = await svc.checkAccess(tenant.clinic.id);
    expect(access.status).toBe('TRIALING');
    expect(access.allowed).toBe(true);
    expect(access.trialEnd).toBeTruthy();
    const trialEnd = new Date(access.trialEnd as string);
    const days = Math.round((trialEnd.getTime() - Date.now()) / 86_400_000);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(8);
  });

  it('denies access after trialEnd even before the expiry job runs', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const plan = await ensureStandardPlan(prisma);
    const past = new Date(Date.now() - 60_000);
    await prisma.subscription.create({
      data: {
        clinicId: tenant.clinic.id,
        planId: plan.id,
        provider: 'manual',
        status: 'TRIALING',
        amountPaise: 180_000,
        currency: 'INR',
        billingInterval: 'MONTHLY',
        startDate: past,
        trialStart: past,
        trialEnd: past,
        currentPeriodStart: past,
        currentPeriodEnd: past,
      },
    });
    const svc = new SubscriptionService(prisma, {} as any, mail as any);
    const access = await svc.checkAccess(tenant.clinic.id);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('TRIAL_EXPIRED');
  });

  it('expiry job flips TRIALING past trialEnd to EXPIRED', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const plan = await ensureStandardPlan(prisma);
    const past = new Date(Date.now() - 60_000);
    await prisma.subscription.create({
      data: {
        clinicId: tenant.clinic.id,
        planId: plan.id,
        provider: 'manual',
        status: 'TRIALING',
        amountPaise: 180_000,
        currency: 'INR',
        billingInterval: 'MONTHLY',
        startDate: past,
        trialStart: past,
        trialEnd: past,
      },
    });
    const jobs = new SubscriptionJobsService(
      prisma,
      { add: vi.fn(), getRepeatableJobs: vi.fn().mockResolvedValue([]) } as any,
      mail as any,
      {} as any,
      {} as any,
    );
    const result = await jobs.runExpiryCheck();
    const sub = await prisma.subscription.findFirst({ where: { clinicId: tenant.clinic.id } });
    expect(sub?.status).toBe('EXPIRED');
    expect(result).toBeTruthy();
  });
});
