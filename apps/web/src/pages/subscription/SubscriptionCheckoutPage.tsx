import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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

type PlanOption = {
  code: string;
  name: string;
  monthlyPricePaise: number;
  monthlyPriceDisplay: string;
  billingAmountPaise: number;
  billingAmountDisplay: string;
  billingInterval: string;
  seatSummary?: string;
};

type CheckoutPayload = {
  checkoutMode?: 'order' | 'subscription';
  keyId: string;
  order_id?: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  amountPaise: number;
  amount?: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
};

type ConfirmResult = {
  verified: boolean;
  activated: boolean;
  message: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function parseCycleParam(value: string | null): BillingCycle {
  return value === 'monthly' ? 'monthly' : 'yearly';
}

function publicKeyId(payloadKey?: string) {
  return payloadKey || import.meta.env.VITE_RAZORPAY_KEY_ID || '';
}

function planLabel(name?: string) {
  if (!name || /medione/i.test(name)) return STANDARD_PLAN_LABEL;
  return name;
}

export function SubscriptionCheckoutPage() {
  const { hasRole, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>(() => parseCycleParam(searchParams.get('cycle')));
  const [busy, setBusy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const checkoutSettled = useRef(false);
  const isAdmin = hasRole('ADMIN', 'CLINIC_ADMIN');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchApi<PlanOption[]>('/subscription/plans');
        if (cancelled) return;
        setPlans(data);
        const fromQuery = searchParams.get('cycle');
        if (fromQuery) setCycle(parseCycleParam(fromQuery));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load plans');
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const selected = useMemo(() => planForCycle(plans, cycle), [plans, cycle]);
  const isYearly = cycle === 'yearly';
  const featured = isYearly;

  const finishSuccess = useCallback(
    async (message: string, activated: boolean) => {
      checkoutSettled.current = true;
      setError(null);
      setInfo(message);
      setBusy(false);
      await refresh().catch(() => undefined);
      if (activated || message.toLowerCase().includes('trial')) {
        try {
          const me = await fetchApi<{ setupComplete?: boolean }>('/auth/me');
          navigate(me.setupComplete === false ? '/setup' : '/dashboard', { replace: true });
        } catch {
          navigate('/dashboard', { replace: true });
        }
      }
    },
    [navigate, refresh],
  );

  const startPay = useCallback(async () => {
    if (!selected) return;
    checkoutSettled.current = false;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const payload = await fetchApi<CheckoutPayload>('/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ planCode: selected.code }),
      });

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error('Could not load Razorpay Checkout');
      }

      const key = publicKeyId(payload.keyId);
      if (!key) throw new Error('Razorpay key is missing.');

      const isOrder =
        payload.checkoutMode === 'order' || Boolean(payload.order_id || payload.razorpayOrderId);

      const options: Record<string, unknown> = {
        key,
        name: payload.name || PRODUCT_NAME,
        description: payload.description,
        currency: payload.currency,
        notes: payload.notes,
        prefill: payload.prefill,
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: () => {
            if (checkoutSettled.current) return;
            setBusy(false);
            setError((prev) => prev ?? 'Checkout closed before payment finished.');
          },
        },
      };

      if (isOrder) {
        options.order_id = payload.order_id || payload.razorpayOrderId;
        options.amount = payload.amountPaise ?? payload.amount;
        options.handler = async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await fetchApi<ConfirmResult>('/subscription/checkout/confirm', {
              method: 'POST',
              body: JSON.stringify(response),
            });
            await finishSuccess(
              result.message || 'Payment verified. Subscription is active.',
              result.activated,
            );
          } catch (e: unknown) {
            checkoutSettled.current = true;
            setError(e instanceof Error ? e.message : 'Payment confirmation failed.');
            setBusy(false);
          }
        };
      } else {
        options.subscription_id = payload.razorpaySubscriptionId;
        options.handler = async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await fetchApi<ConfirmResult>('/subscription/checkout/confirm', {
              method: 'POST',
              body: JSON.stringify(response),
            });
            await finishSuccess(
              result.message || 'Payment verified. Subscription is active.',
              result.activated,
            );
          } catch (e: unknown) {
            checkoutSettled.current = true;
            setError(e instanceof Error ? e.message : 'Payment confirmation failed.');
            setBusy(false);
          }
        };
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        if (checkoutSettled.current) return;
        checkoutSettled.current = true;
        const desc =
          (response?.error as { description?: string } | undefined)?.description ||
          'Payment failed. Please try again.';
        setInfo(null);
        setError(desc);
        setBusy(false);
      });
      rzp.open();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed.');
      setBusy(false);
    }
  }, [finishSuccess, selected]);

  if (!isAdmin) {
    return (
      <div className="pricing-page">
        <main className="pricing-main" style={{ paddingTop: '4rem' }}>
          <p className="pricing-card-desc" style={{ textAlign: 'center' }}>
            Only clinic admins can manage billing.
          </p>
          <Link to="/dashboard" className="pricing-cta" style={{ maxWidth: 280, marginTop: 16 }}>
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      <header className="pricing-top">
        <Link to="/subscription" className="pricing-brand" aria-label={PRODUCT_NAME}>
          <ProductLogo className="h-9 w-auto max-w-[160px]" />
        </Link>
        <div className="pricing-top-actions">
          <BillingCycleToggle value={cycle} onChange={setCycle} />
          <Link to="/subscription" className="pricing-signin">
            Billing
          </Link>
        </div>
      </header>

      <main className="pricing-main">
        <h1 className="pricing-heading">Checkout</h1>

        {loadingPlans && (
          <div className="pricing-loading">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loadingPlans && selected && (
          <article className={`pricing-card ${featured ? 'pricing-card--featured' : ''}`}>
            {featured ? (
              <span className="pricing-card-badge">Save 22%</span>
            ) : (
              <span className="pricing-card-badge pricing-card-badge--soft">Monthly</span>
            )}

            <h2 className="pricing-card-name">{planLabel(selected.name)}</h2>

            <div className="pricing-card-price">
              {isYearly && (
                <span className="pricing-card-was">{formatPaise(REFERENCE_MONTHLY_PAISE)}</span>
              )}
              <span className="pricing-card-amount">{selected.monthlyPriceDisplay}</span>
              <span className="pricing-card-unit">/ month</span>
            </div>
            <p className="pricing-card-billed">
              {isYearly
                ? '7 days free · Then ₹21,600/year'
                : '7 days free · Then ₹2,300/month'}
            </p>

            <p className="pricing-card-desc">
              {selected.seatSummary ?? '10 staff + 1 admin'} · Cancel anytime · No charge today
            </p>

            <button
              type="button"
              className="pricing-cta"
              disabled={busy}
              onClick={() => void startPay()}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening…
                </span>
              ) : (
                'Start 7-Day Free Trial'
              )}
            </button>
          </article>
        )}

        {!loadingPlans && !selected && !error && (
          <p className="pricing-empty">No plans available.</p>
        )}

        {error && !info && (
          <div className="pricing-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
        {info && (
          <div className="checkout-success">
            {info}{' '}
            <Link to="/subscription">View billing</Link>
          </div>
        )}
      </main>
    </div>
  );
}
