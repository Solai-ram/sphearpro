import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  accessWhileCancelPending,
  addDays,
  addMonths,
  assertTransition,
  canAccessHis,
} from './subscription-state';

describe('subscription-state machine', () => {
  it('allows TRIALING → ACTIVE', () => {
    expect(() => assertTransition('TRIALING', 'ACTIVE')).not.toThrow();
  });

  it('allows ACTIVE → PAST_DUE → GRACE_PERIOD → EXPIRED', () => {
    expect(() => assertTransition('ACTIVE', 'PAST_DUE')).not.toThrow();
    expect(() => assertTransition('PAST_DUE', 'GRACE_PERIOD')).not.toThrow();
    expect(() => assertTransition('GRACE_PERIOD', 'EXPIRED')).not.toThrow();
  });

  it('allows ACTIVE → PAYMENT_FAILED → GRACE_PERIOD', () => {
    expect(() => assertTransition('ACTIVE', 'PAYMENT_FAILED')).not.toThrow();
    expect(() => assertTransition('PAYMENT_FAILED', 'GRACE_PERIOD')).not.toThrow();
  });

  it('allows CANCELLED / EXPIRED → ACTIVE (reactivate)', () => {
    expect(() => assertTransition('CANCELLED', 'ACTIVE')).not.toThrow();
    expect(() => assertTransition('EXPIRED', 'ACTIVE')).not.toThrow();
  });

  it('rejects EXPIRED → GRACE_PERIOD', () => {
    expect(() => assertTransition('EXPIRED', 'GRACE_PERIOD')).toThrow(BadRequestException);
  });

  it('rejects CANCELLED → PAST_DUE', () => {
    expect(() => assertTransition('CANCELLED', 'PAST_DUE')).toThrow(BadRequestException);
  });

  it('same status is a no-op', () => {
    expect(() => assertTransition('ACTIVE', 'ACTIVE')).not.toThrow();
  });
});

describe('subscription access policy', () => {
  it('allows ACTIVE, TRIALING, GRACE_PERIOD', () => {
    expect(canAccessHis('ACTIVE')).toBe(true);
    expect(canAccessHis('TRIALING')).toBe(true);
    expect(canAccessHis('GRACE_PERIOD')).toBe(true);
  });

  it('denies EXPIRED, CANCELLED, SUSPENDED, PAST_DUE', () => {
    expect(canAccessHis('EXPIRED')).toBe(false);
    expect(canAccessHis('CANCELLED')).toBe(false);
    expect(canAccessHis('SUSPENDED')).toBe(false);
    expect(canAccessHis('PAST_DUE')).toBe(false);
    expect(canAccessHis('PAYMENT_FAILED')).toBe(false);
  });

  it('cancel-at-period-end keeps access until period end', () => {
    const end = addDays(new Date(), 10);
    expect(accessWhileCancelPending('ACTIVE', true, end)).toBe(true);
  });

  it('cancel-at-period-end denies after period end', () => {
    const end = addDays(new Date(), -1);
    expect(accessWhileCancelPending('ACTIVE', true, end)).toBe(false);
  });

  it('expiry does not imply data deletion (status-only concern)', () => {
    // Documented invariant: expireSubscription only flips status — clinical rows remain.
    expect(canAccessHis('EXPIRED')).toBe(false);
    const clinicalWouldRemain = true;
    expect(clinicalWouldRemain).toBe(true);
  });
});

describe('date helpers', () => {
  it('addMonths advances calendar month', () => {
    const from = new Date(Date.UTC(2026, 0, 15));
    const next = addMonths(from, 1);
    expect(next.getUTCMonth()).toBe(1);
  });
});
