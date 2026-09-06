import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCT_NAME, STANDARD_PLAN_LABEL } from '../../lib/product';
import { ProductLogo } from '../../components/ProductLogo';
import { formatPaise } from './types';
import {
  BillingCycleToggle,
  REFERENCE_MONTHLY_PAISE,
  planForCycle,
  type BillingCycle,
} from './BillingCycleToggle';

type PlanFeature = { code: string; name: string };
type Plan = {
  id: string;
  code: string;
  name: string;
  monthlyPricePaise: number;
  monthlyPriceDisplay: string;
  billingAmountPaise: number;
  billingAmountDisplay: string;
  billingInterval: string;
  seatSummary?: string;
  features: PlanFeature[];
};

/** Keep the page scannable — short labels only. */
const HIGHLIGHTS = [
  'Patients & OP',
  'Therapy packages',
  'Billing & invoices',
  'Inventory',
  'Staff seats & roles',
  'Reports',
] as const;

const NOT_INCLUDED = ['WhatsApp messaging', 'Multi-branch'] as const;

export function PricingPage() {
  const { user, hasRole } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchApi<Plan[]>('/subscription/plans');
        if (!cancelled) setPlans(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => planForCycle(plans, cycle), [plans, cycle]);
  const canCheckout = Boolean(user && hasRole('ADMIN', 'CLINIC_ADMIN'));
  const isYearly = cycle === 'yearly';
  const featured = isYearly;

  const ctaTo = canCheckout
    ? `/subscription/checkout?cycle=${cycle}`
    : `/signup?cycle=${cycle}`;
  const ctaLabel = 'Start 7-Day Free Trial';

  return (
    <div className="pricing-page">
      <header className="pricing-top">
        <Link to={user ? '/dashboard' : '/login'} className="pricing-brand" aria-label={PRODUCT_NAME}>
          <ProductLogo className="h-9 w-auto max-w-[160px]" />
        </Link>
        <div className="pricing-top-actions">
          <BillingCycleToggle value={cycle} onChange={setCycle} />
          <Link to={user ? '/dashboard' : '/login'} className="pricing-signin">
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
        </div>
      </header>

      <main className="pricing-main">
        <h1 className="pricing-heading">Pricing</h1>

        {loading && (
          <div className="pricing-loading">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && <div className="pricing-error">{error}</div>}

        {!loading && !error && selected && (
          <article className={`pricing-card ${featured ? 'pricing-card--featured' : ''}`}>
            {featured ? (
              <span className="pricing-card-badge">Save 17%</span>
            ) : (
              <span className="pricing-card-badge pricing-card-badge--soft">Monthly</span>
            )}

            <h2 className="pricing-card-name">{selected.name || STANDARD_PLAN_LABEL}</h2>

            <div className="pricing-card-price">
              {isYearly && (
                <span className="pricing-card-was">{formatPaise(REFERENCE_MONTHLY_PAISE)}</span>
              )}
              <span className="pricing-card-amount">{selected.monthlyPriceDisplay}</span>
              <span className="pricing-card-unit">/ month</span>
            </div>
            <p className="pricing-card-billed">
              {isYearly
                ? '7 days free · Then ₹18,000/year'
                : '7 days free · Then ₹1,800/month'}
            </p>

            <p className="pricing-card-desc">
              Everything your clinic needs — {selected.seatSummary ?? '5 staff + 1 admin'}. Cancel
              anytime. No charge today.
            </p>

            <ul className="pricing-features">
              {HIGHLIGHTS.map((item) => (
                <li key={item}>
                  <span className="pricing-feature-yes" aria-hidden>
                    <Check />
                  </span>
                  {item}
                </li>
              ))}
              {NOT_INCLUDED.map((item) => (
                <li key={item} className="pricing-feature-no">
                  <span className="pricing-feature-x" aria-hidden>
                    <X />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Link to={ctaTo} className="pricing-cta">
              {ctaLabel}
            </Link>
          </article>
        )}

        {!loading && plans.length === 0 && !error && (
          <p className="pricing-empty">No plans available yet.</p>
        )}
      </main>
    </div>
  );
}
