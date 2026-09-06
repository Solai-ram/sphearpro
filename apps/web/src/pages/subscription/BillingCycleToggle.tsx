export type BillingCycle = 'monthly' | 'yearly';

type Props = {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
};

/** Hostinger-style monthly vs yearly switch with discount badge on annual. */
export function BillingCycleToggle({ value, onChange, className = '' }: Props) {
  return (
    <div
      className={`inline-flex rounded-full border border-[var(--border)] bg-[var(--app-bg)] p-1 ${className}`}
      role="tablist"
      aria-label="Billing cycle"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'monthly'}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === 'monthly'
            ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
        onClick={() => onChange('monthly')}
      >
        Monthly
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'yearly'}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === 'yearly'
            ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
        onClick={() => onChange('yearly')}
      >
        Annual
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          Save 17%
        </span>
      </button>
    </div>
  );
}

export function planForCycle<T extends { billingInterval: string; code: string }>(
  plans: T[],
  cycle: BillingCycle,
): T | undefined {
  return plans.find((p) =>
    cycle === 'yearly' ? p.billingInterval === 'YEARLY' : p.billingInterval === 'MONTHLY',
  );
}

export const REFERENCE_MONTHLY_PAISE = 180_000;
