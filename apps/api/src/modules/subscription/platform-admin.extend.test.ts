import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';

describe('Phase 12 — platform admin extend / suspend', () => {
  let prisma: any;
  let audit: { log: ReturnType<typeof vi.fn> };
  let svc: PlatformAdminService;
  let sub: any;

  beforeEach(() => {
    const now = new Date();
    sub = {
      id: 'sub_1',
      clinicId: 'clinic_a',
      status: 'EXPIRED',
      amountPaise: 230000,
      currency: 'INR',
      currentPeriodEnd: new Date(now.getTime() - 86400000),
      plan: { id: 'p1', code: 'STANDARD', name: 'Standard', monthlyPricePaise: 230000, maxStaffUsers: 10, maxAdminUsers: 1 },
      clinic: { id: 'clinic_a', name: 'Sunrise', slug: 'sunrise', email: 'a@x.com', status: 'ACTIVE' },
    };

    prisma = {
      subscription: {
        findUnique: vi.fn(async () => sub),
        update: vi.fn(async ({ data }: any) => {
          Object.assign(sub, data);
          return sub;
        }),
      },
      subscriptionEvent: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
    };
    // getSubscription after extend uses findUnique with include
    prisma.subscription.findUnique = vi.fn(async () => sub);

    audit = { log: vi.fn().mockResolvedValue({}) };
    svc = new PlatformAdminService(prisma as any, audit as any);
  });

  it('extend requires reason and valid days', async () => {
    await expect(svc.extend('sub_1', 'actor_1', { days: 7, reason: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      svc.extend('sub_1', 'actor_1', { days: 0, reason: 'goodwill' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manual extend restores EXPIRED → ACTIVE and audits', async () => {
    const result = await svc.extend('sub_1', 'actor_1', {
      days: 14,
      reason: 'support goodwill',
    });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PLATFORM_SUBSCRIPTION_EXTEND',
        clinicId: 'clinic_a',
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });
});
