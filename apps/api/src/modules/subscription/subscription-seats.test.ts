import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import { SAAS_ERROR, SaasHttpException } from './razorpay.errors';

describe('Standard seat limits', () => {
  let prisma: any;
  let svc: SubscriptionService;

  beforeEach(() => {
    prisma = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({
          plan: { maxStaffUsers: 5, maxAdminUsers: 1 },
        }),
      },
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role_admin', name: 'ADMIN' }) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { staffType: 'ADMIN', roles: [{ role: { name: 'ADMIN' } }] },
          { staffType: 'THERAPIST', roles: [] },
          { staffType: 'THERAPIST', roles: [] },
          { staffType: 'THERAPIST', roles: [] },
          { staffType: 'THERAPIST', roles: [] },
          { staffType: 'THERAPIST', roles: [] },
        ]),
      },
    };
    svc = new SubscriptionService(prisma, {} as RazorpayService, {} as any);
  });

  it('blocks a 6th staff user', async () => {
    try {
      await svc.assertClinicUserSeatAvailable('clinic_a', { staffType: 'THERAPIST' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SaasHttpException);
      const body = (err as SaasHttpException).getResponse() as { error: { code: string } };
      expect(body.error.code).toBe(SAAS_ERROR.SEAT_LIMIT_EXCEEDED);
    }
  });

  it('blocks a 2nd admin', async () => {
    try {
      await svc.assertClinicUserSeatAvailable('clinic_a', { staffType: 'ADMIN' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SaasHttpException);
      expect((err as SaasHttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('reports seat usage', async () => {
    const usage = await svc.getClinicSeatUsage('clinic_a');
    expect(usage).toEqual({
      maxStaffUsers: 5,
      maxAdminUsers: 1,
      usedStaffUsers: 5,
      usedAdminUsers: 1,
      remainingStaffUsers: 0,
      remainingAdminUsers: 0,
    });
  });
});
