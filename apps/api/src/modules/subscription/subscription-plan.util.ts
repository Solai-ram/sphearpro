import { SubscriptionBillingInterval } from '@prisma/client';

/** Monthly billing — ₹1,800/mo */
export const STANDARD_MONTHLY_CODE = 'STANDARD';
/** Yearly billing — ₹1,500/mo effective (₹18,000/yr) */
export const STANDARD_YEARLY_CODE = 'STANDARD_YEARLY';

export const STANDARD_MONTHLY_PAISE = 180_000;
export const STANDARD_YEARLY_MONTHLY_EQUIVALENT_PAISE = 150_000;
export const STANDARD_MAX_STAFF = 5;
export const STANDARD_MAX_ADMIN = 1;

export type PlanPricingRow = {
  monthlyPricePaise: number;
  billingInterval: SubscriptionBillingInterval;
};

/** Amount charged per billing cycle (not the display monthly rate for yearly). */
export function planBillingAmountPaise(plan: PlanPricingRow): number {
  if (plan.billingInterval === 'YEARLY') {
    return plan.monthlyPricePaise * 12;
  }
  return plan.monthlyPricePaise;
}

export function billingPeriodMonths(interval: SubscriptionBillingInterval): number {
  return interval === 'YEARLY' ? 12 : 1;
}

export function formatInrPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function isAdminStaffType(staffType?: string | null): boolean {
  return staffType === 'ADMIN';
}

export function roleIdsIncludeAdmin(
  roleIds: string[] | undefined,
  adminRoleId: string | undefined,
): boolean {
  if (!adminRoleId || !roleIds?.length) return false;
  return roleIds.includes(adminRoleId);
}
