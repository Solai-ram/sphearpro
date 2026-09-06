import { BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

/** Statuses that still allow HIS application access (Phase 7 will enforce). */
export const ACCESS_ALLOWED_STATUSES: readonly SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'GRACE_PERIOD',
] as const;

const TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  TRIALING: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'PAYMENT_FAILED', 'PAST_DUE', 'GRACE_PERIOD'],
  ACTIVE: ['PAST_DUE', 'PAYMENT_FAILED', 'GRACE_PERIOD', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  PAST_DUE: ['ACTIVE', 'PAYMENT_FAILED', 'GRACE_PERIOD', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  PAYMENT_FAILED: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  GRACE_PERIOD: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'PAYMENT_FAILED'],
  CANCELLED: ['ACTIVE', 'TRIALING'], // reactivate
  EXPIRED: ['ACTIVE', 'TRIALING'], // renew / reactivate
  SUSPENDED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
};

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (from === to) return;
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Invalid subscription transition: ${from} → ${to}`);
  }
}

export function canAccessHis(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return (ACCESS_ALLOWED_STATUSES as readonly string[]).includes(status);
}

/** Cancel-at-period-end: still allowed until period end (caller passes now vs end). */
export function accessWhileCancelPending(
  status: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
  currentPeriodEnd: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!canAccessHis(status)) return false;
  if (!cancelAtPeriodEnd) return true;
  if (!currentPeriodEnd) return true;
  return currentPeriodEnd.getTime() > now.getTime();
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export const SUBSCRIPTION_EVENT = {
  CREATED: 'SUBSCRIPTION_CREATED',
  ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  RENEWED: 'SUBSCRIPTION_RENEWED',
  PAYMENT_FAILED: 'SUBSCRIPTION_PAYMENT_FAILED',
  PAST_DUE: 'SUBSCRIPTION_PAST_DUE',
  GRACE_PERIOD: 'SUBSCRIPTION_GRACE_PERIOD',
  CANCELLED: 'SUBSCRIPTION_CANCELLED',
  EXPIRED: 'SUBSCRIPTION_EXPIRED',
  PLAN_CHANGED: 'PLAN_CHANGED',
  REACTIVATED: 'SUBSCRIPTION_REACTIVATED',
  SUSPENDED: 'SUBSCRIPTION_SUSPENDED',
} as const;
