import { describe, expect, it } from 'vitest';
import {
  billingPeriodMonths,
  planBillingAmountPaise,
  STANDARD_MONTHLY_PAISE,
  STANDARD_YEARLY_MONTHLY_EQUIVALENT_PAISE,
} from './subscription-plan.util';

describe('subscription-plan.util', () => {
  it('charges monthly plan per month', () => {
    expect(
      planBillingAmountPaise({
        monthlyPricePaise: STANDARD_MONTHLY_PAISE,
        billingInterval: 'MONTHLY',
      }),
    ).toBe(180_000);
  });

  it('charges yearly plan as 12× display monthly rate', () => {
    expect(
      planBillingAmountPaise({
        monthlyPricePaise: STANDARD_YEARLY_MONTHLY_EQUIVALENT_PAISE,
        billingInterval: 'YEARLY',
      }),
    ).toBe(1_800_000);
  });

  it('maps billing interval to period months', () => {
    expect(billingPeriodMonths('MONTHLY')).toBe(1);
    expect(billingPeriodMonths('YEARLY')).toBe(12);
  });
});
