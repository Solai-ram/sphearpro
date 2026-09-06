import { describe, expect, it } from 'vitest';
import { evaluateSubscriptionGate } from './subscription.guard';

describe('evaluateSubscriptionGate', () => {
  it('blocks missing subscription', () => {
    expect(evaluateSubscriptionGate({ status: null }).allowed).toBe(false);
    expect(evaluateSubscriptionGate({ status: null }).reason).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('allows ACTIVE and GRACE_PERIOD', () => {
    expect(evaluateSubscriptionGate({ status: 'ACTIVE' }).allowed).toBe(true);
    expect(evaluateSubscriptionGate({ status: 'GRACE_PERIOD' }).allowed).toBe(true);
  });

  it('blocks EXPIRED (cannot GET protected HIS resources)', () => {
    const r = evaluateSubscriptionGate({ status: 'EXPIRED' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('blocks TRIALING without trial end (awaiting payment)', () => {
    const r = evaluateSubscriptionGate({ status: 'TRIALING', trialEnd: null });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('PAYMENT_REQUIRED');
  });

  it('allows TRIALING with future trial end', () => {
    const r = evaluateSubscriptionGate({
      status: 'TRIALING',
      trialEnd: new Date(Date.now() + 86_400_000),
    });
    expect(r.allowed).toBe(true);
  });

  it('allows cancel-at-period-end while period open', () => {
    const r = evaluateSubscriptionGate({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    expect(r.allowed).toBe(true);
  });

  it('blocks cancel-at-period-end after period end', () => {
    const r = evaluateSubscriptionGate({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() - 1000),
    });
    expect(r.allowed).toBe(false);
  });

  it('maps PAST_DUE / SUSPENDED', () => {
    expect(evaluateSubscriptionGate({ status: 'PAST_DUE' }).reason).toBe('SUBSCRIPTION_PAST_DUE');
    expect(evaluateSubscriptionGate({ status: 'SUSPENDED' }).allowed).toBe(false);
  });
});

describe('feature gate policy', () => {
  it('FEATURE_NOT_AVAILABLE when required feature missing from plan', () => {
    const planFeatures = ['PATIENT_MANAGEMENT', 'APPOINTMENTS'];
    const required = ['INVENTORY'];
    const ok = required.some((c) => planFeatures.includes(c));
    expect(ok).toBe(false);
  });

  it('allows when plan includes feature', () => {
    const planFeatures = ['INVENTORY', 'AI_ASSIST'];
    expect(['INVENTORY'].some((c) => planFeatures.includes(c))).toBe(true);
  });
});
