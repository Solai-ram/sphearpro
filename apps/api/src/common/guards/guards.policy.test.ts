import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { FeatureGuard } from './feature.guard';
import { SubscriptionGuard, evaluateSubscriptionGate } from './subscription.guard';
import { SaasHttpException, SAAS_ERROR } from '../../modules/subscription/razorpay.errors';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { REQUIRE_FEATURE_KEY, SKIP_SUBSCRIPTION_KEY } from '../decorators/subscription.decorator';

function ctx(user?: Record<string, unknown> | null, extra: Record<string, unknown> = {}) {
  const request: any = { user, ...extra };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    request,
  } as any;
}

describe('PermissionsGuard', () => {
  it('allows when no permissions are required', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const guard = new PermissionsGuard(reflector as any);
    expect(guard.canActivate(ctx({ roles: [] }))).toBe(true);
  });

  it('allows ADMIN role without checking permission list', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['patients.view']) };
    const guard = new PermissionsGuard(reflector as any);
    expect(guard.canActivate(ctx({ roles: ['ADMIN'], permissions: [] }))).toBe(true);
  });

  it('allows when every required permission is present', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['patients.view', 'patients.create']) };
    const guard = new PermissionsGuard(reflector as any);
    expect(
      guard.canActivate(ctx({ roles: ['DOCTOR'], permissions: ['patients.view', 'patients.create'] })),
    ).toBe(true);
  });

  it('denies missing user', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['patients.view']) };
    const guard = new PermissionsGuard(reflector as any);
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });

  it('denies when a required permission is missing', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['billing.invoice.create']) };
    const guard = new PermissionsGuard(reflector as any);
    expect(() =>
      guard.canActivate(ctx({ roles: ['DOCTOR'], permissions: ['patients.view'] })),
    ).toThrow(ForbiddenException);
  });

  it('reads REQUIRE_PERMISSIONS_KEY from reflector', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([]) };
    const guard = new PermissionsGuard(reflector as any);
    const c = ctx({ roles: [] });
    guard.canActivate(c);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_PERMISSIONS_KEY, [
      c.getHandler(),
      c.getClass(),
    ]);
  });
});

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows SUPER_ADMIN', () => {
    expect(guard.canActivate(ctx({ roles: ['SUPER_ADMIN'] }))).toBe(true);
  });

  it('blocks clinic ADMIN', () => {
    expect(() => guard.canActivate(ctx({ roles: ['ADMIN'] }))).toThrow(ForbiddenException);
  });

  it('blocks missing user', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});

describe('FeatureGuard', () => {
  const prev = process.env.SUBSCRIPTION_ENFORCE;

  beforeEach(() => {
    process.env.SUBSCRIPTION_ENFORCE = 'true';
  });

  afterEach(() => {
    process.env.SUBSCRIPTION_ENFORCE = prev;
  });

  it('allows when no features are required', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const guard = new FeatureGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['ADMIN'] }))).resolves.toBe(true);
  });

  it('bypasses when SUBSCRIPTION_ENFORCE=false', async () => {
    process.env.SUBSCRIPTION_ENFORCE = 'false';
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['INVENTORY']) };
    const guard = new FeatureGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['ADMIN'], clinicId: 'c1' }))).resolves.toBe(true);
    process.env.SUBSCRIPTION_ENFORCE = prev;
  });

  it('allows SUPER_ADMIN without checking features', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['INVENTORY']) };
    const guard = new FeatureGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['SUPER_ADMIN'] }))).resolves.toBe(true);
  });

  it('throws FEATURE_NOT_AVAILABLE without clinic', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['INVENTORY']) };
    const guard = new FeatureGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['ADMIN'] }))).rejects.toBeInstanceOf(SaasHttpException);
  });

  it('uses cached subscriptionAccess.features on the request', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['INVENTORY']) };
    const checkAccess = vi.fn();
    const guard = new FeatureGuard(reflector as any, { checkAccess } as any);
    const c = ctx(
      { roles: ['ADMIN'], clinicId: 'c1' },
      { subscriptionAccess: { features: ['INVENTORY'] } },
    );
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('loads features via checkAccess when not cached', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['AI_ASSIST']) };
    const checkAccess = vi.fn().mockResolvedValue({ features: ['AI_ASSIST'], allowed: true });
    const guard = new FeatureGuard(reflector as any, { checkAccess } as any);
    const c = ctx({ roles: ['ADMIN'], clinicId: 'c1' });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(checkAccess).toHaveBeenCalledWith('c1');
  });

  it('denies when required feature is not on the plan', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['INVENTORY']) };
    const checkAccess = vi.fn().mockResolvedValue({ features: ['PATIENT_MANAGEMENT'] });
    const guard = new FeatureGuard(reflector as any, { checkAccess } as any);
    await expect(guard.canActivate(ctx({ roles: ['ADMIN'], clinicId: 'c1' }))).rejects.toMatchObject({
      response: { error: { code: SAAS_ERROR.FEATURE_NOT_AVAILABLE } },
    });
    expect(REQUIRE_FEATURE_KEY).toBe('requireFeature');
  });
});

describe('SubscriptionGuard', () => {
  const prev = process.env.SUBSCRIPTION_ENFORCE;

  beforeEach(() => {
    process.env.SUBSCRIPTION_ENFORCE = 'true';
  });

  afterEach(() => {
    process.env.SUBSCRIPTION_ENFORCE = prev;
  });

  it('passes when enforcement is disabled', async () => {
    process.env.SUBSCRIPTION_ENFORCE = 'false';
    const guard = new SubscriptionGuard({ getAllAndOverride: vi.fn() } as any, {} as any);
    await expect(guard.canActivate(ctx({ clinicId: 'c1' }))).resolves.toBe(true);
    process.env.SUBSCRIPTION_ENFORCE = prev;
  });

  it('skips when @SkipSubscription is set', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) };
    const guard = new SubscriptionGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ clinicId: 'c1' }))).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(SKIP_SUBSCRIPTION_KEY, expect.any(Array));
  });

  it('passes unauthenticated requests', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new SubscriptionGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN without clinic subscription', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new SubscriptionGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['SUPER_ADMIN'] }))).resolves.toBe(true);
  });

  it('rejects users without clinicId', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new SubscriptionGuard(reflector as any, {} as any);
    await expect(guard.canActivate(ctx({ roles: ['ADMIN'] }))).rejects.toBeInstanceOf(SaasHttpException);
  });

  it('allows when checkAccess.allowed is true', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const checkAccess = vi.fn().mockResolvedValue({ allowed: true, status: 'ACTIVE', reason: null });
    const guard = new SubscriptionGuard(reflector as any, { checkAccess } as any);
    const c = ctx({ roles: ['ADMIN'], clinicId: 'c1' });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(c.request.subscriptionAccess.allowed).toBe(true);
  });

  it('maps TRIAL_EXPIRED to PAYMENT_REQUIRED', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const checkAccess = vi.fn().mockResolvedValue({
      allowed: false,
      status: 'TRIALING',
      reason: 'TRIAL_EXPIRED',
    });
    const guard = new SubscriptionGuard(reflector as any, { checkAccess } as any);
    try {
      await guard.canActivate(ctx({ roles: ['ADMIN'], clinicId: 'c1' }));
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SaasHttpException);
      const body = (err as SaasHttpException).getResponse() as { error: { code: string; message: string } };
      expect(body.error.code).toBe(SAAS_ERROR.PAYMENT_REQUIRED);
      expect(body.error.message).toMatch(/free trial has ended/i);
    }
  });

  it('maps EXPIRED / CANCELLED / PAST_DUE / generic reasons', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const cases: Array<{ reason: string; status: string; code: string }> = [
      { reason: 'SUBSCRIPTION_EXPIRED', status: 'EXPIRED', code: SAAS_ERROR.SUBSCRIPTION_EXPIRED },
      { reason: 'SUBSCRIPTION_CANCELLED', status: 'CANCELLED', code: SAAS_ERROR.SUBSCRIPTION_CANCELLED },
      { reason: 'SUBSCRIPTION_PAST_DUE', status: 'PAST_DUE', code: SAAS_ERROR.SUBSCRIPTION_PAST_DUE },
      { reason: 'SUBSCRIPTION_REQUIRED', status: null as any, code: SAAS_ERROR.SUBSCRIPTION_REQUIRED },
    ];
    for (const row of cases) {
      const checkAccess = vi.fn().mockResolvedValue({ allowed: false, ...row });
      const guard = new SubscriptionGuard(reflector as any, { checkAccess } as any);
      try {
        await guard.canActivate(ctx({ roles: ['ADMIN'], clinicId: 'c1' }));
        expect.fail(`expected throw for ${row.reason}`);
      } catch (err) {
        const body = (err as SaasHttpException).getResponse() as { error: { code: string } };
        expect(body.error.code).toBe(row.code);
      }
    }
  });
});

describe('evaluateSubscriptionGate extra statuses', () => {
  it('blocks expired trial', () => {
    const r = evaluateSubscriptionGate({
      status: 'TRIALING',
      trialEnd: new Date(Date.now() - 1000),
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TRIAL_EXPIRED');
  });

  it('maps CANCELLED', () => {
    const r = evaluateSubscriptionGate({ status: 'CANCELLED' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('SUBSCRIPTION_CANCELLED');
  });

  it('maps PAYMENT_FAILED as past due', () => {
    const r = evaluateSubscriptionGate({ status: 'PAYMENT_FAILED' });
    expect(r.reason).toBe('SUBSCRIPTION_PAST_DUE');
  });
});
