import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Ban,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCT_NAME, STANDARD_PLAN_LABEL } from '../../lib/product';
import {
  type ClinicSubscription,
  type SubscriptionAccess,
  formatDate,
  statusBadgeClass,
  statusLabel,
} from './types';

type CurrentResponse = {
  subscription: ClinicSubscription | null;
  access: SubscriptionAccess;
  seats?: ClinicSeatUsage;
};

function StatusBanner({
  subscription,
  access,
}: {
  subscription: ClinicSubscription | null;
  access: SubscriptionAccess;
}) {
  const status = subscription?.status || access.status;
  const planName = subscription?.plan?.name || STANDARD_PLAN_LABEL;
  const nextBill = formatDate(subscription?.currentPeriodEnd || access.currentPeriodEnd);

  if (!subscription) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        No subscription yet. Choose a plan and complete checkout to unlock {PRODUCT_NAME}.
      </div>
    );
  }

  if (status === 'ACTIVE' && !subscription.cancelAtPeriodEnd) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Your <strong>{planName}</strong> plan is active. Next billing date: {nextBill}.
      </div>
    );
  }

  if (status === 'ACTIVE' && subscription.cancelAtPeriodEnd) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Cancellation scheduled. You keep access until {nextBill}.
      </div>
    );
  }

  if (status === 'GRACE_PERIOD') {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
        Your subscription payment failed. Please update payment to avoid service interruption.
        {subscription.gracePeriodEnd
          ? ` Grace ends ${formatDate(subscription.gracePeriodEnd)}.`
          : ''}
      </div>
    );
  }

  if (status === 'EXPIRED' || status === 'SUSPENDED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Your subscription has expired. Renew now to continue using {PRODUCT_NAME}.
      </div>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Your subscription is cancelled. Reactivate or start checkout to restore access.
      </div>
    );
  }

  if (status === 'TRIALING') {
    const trialEnd = sub?.trialEnd ? new Date(sub.trialEnd) : null;
    const daysLeft = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
      : null;
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        {daysLeft !== null ? (
          <>
            🎉 You're on a <strong>free trial</strong> — <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> remaining
            {trialEnd && <span className="ml-1 text-sky-700">(expires {trialEnd.toLocaleDateString()})</span>}.
            {' '}Subscribe before the trial ends to keep using all features.
          </>
        ) : (
          <>Subscription is awaiting payment confirmation. Complete checkout if you have not paid yet.</>
        )}
      </div>
    );
  }

  return null;
}

export function SubscriptionBillingPage() {
  const { hasRole, refresh } = useAuth();
  const isAdmin = hasRole('ADMIN', 'CLINIC_ADMIN');
  const [data, setData] = useState<CurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<CurrentResponse>('/subscription');
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Only clinic admins can manage SaaS billing.</p>
        <Link to="/dashboard" className="btn-secondary mt-4 inline-flex">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const sub = data?.subscription;
  const access = data?.access;
  const seats = data?.seats;

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(label);
      await load();
      await refresh().catch(() => undefined);
    } catch (e: any) {
      setError(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-8 px-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--primary-text)]">{PRODUCT_NAME}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Subscription & billing</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage your clinic plan, renewals, and SaaS invoices (separate from patient billing).
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="mt-12 flex justify-center text-[var(--muted)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && access && (
        <div className="mt-6 space-y-6">
          <StatusBanner subscription={sub} access={access} />

          <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{sub?.plan?.name || 'No plan'}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {sub?.plan?.description || 'Subscribe to unlock clinic HIS features.'}
                </p>
              </div>
              <span
                className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(
                  sub?.status || access.status,
                )}`}
              >
                {statusLabel(sub?.status || access.status)}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Price</dt>
                <dd className="mt-1 text-sm font-medium">
                  {sub?.plan ? (
                    sub.billingInterval === 'YEARLY' ? (
                      <>
                        {sub.plan.monthlyPriceDisplay}/mo{' '}
                        <span className="text-[var(--muted)]">
                          (₹18,000 billed yearly — save vs ₹1,800/mo monthly)
                        </span>
                      </>
                    ) : (
                      <>
                        {sub.plan.monthlyPriceDisplay}/mo{' '}
                        <span className="text-[var(--muted)]">(billed monthly)</span>
                      </>
                    )
                  ) : (
                    '₹1,800/mo monthly · ₹1,500/mo on yearly (₹18,000/year)'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Seats</dt>
                <dd className="mt-1 text-sm font-medium">
                  {seats
                    ? `${seats.usedStaffUsers}/${seats.maxStaffUsers} staff · ${seats.usedAdminUsers}/${seats.maxAdminUsers} admin`
                    : sub?.plan?.seatSummary || '5 staff + 1 admin'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Access</dt>
                <dd className="mt-1 text-sm font-medium">
                  {access.allowed ? 'HIS features available' : 'Restricted — renew to continue'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Period start</dt>
                <dd className="mt-1 text-sm">{formatDate(sub?.currentPeriodStart)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Next billing / period end</dt>
                <dd className="mt-1 text-sm">{formatDate(sub?.currentPeriodEnd)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Payment method</dt>
                <dd className="mt-1 text-sm">
                  {sub?.providerSubscriptionId
                    ? `Razorpay (${sub.provider})`
                    : sub?.provider === 'manual'
                      ? 'Manual / local (dev)'
                      : 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Provider subscription</dt>
                <dd className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
                  {sub?.providerSubscriptionId || '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/subscription/checkout" className="btn-primary inline-flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4" />
                {sub?.status === 'ACTIVE' ? 'Manage / pay' : 'Checkout / renew'}
              </Link>
              <Link to="/pricing" className="btn-secondary inline-flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4" />
                View plan
              </Link>
              <Link to="/subscription/payments" className="btn-secondary inline-flex items-center gap-2 text-sm">
                Payments
              </Link>
              <Link to="/subscription/invoices" className="btn-secondary inline-flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Invoices
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
              {sub && ['ACTIVE', 'GRACE_PERIOD', 'TRIALING'].includes(sub.status) && !sub.cancelAtPeriodEnd && (
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 text-sm text-red-700"
                  disabled={busy}
                  onClick={() =>
                    void runAction('Cancellation scheduled at period end.', () =>
                      fetchApi('/subscription/cancel', {
                        method: 'POST',
                        body: JSON.stringify({ atPeriodEnd: true }),
                      }),
                    )
                  }
                >
                  <Ban className="h-4 w-4" />
                  Cancel at period end
                </button>
              )}
              {sub?.cancelAtPeriodEnd && (
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction('Reactivated — cancel flag cleared via renew.', () =>
                      fetchApi('/subscription/renew', { method: 'POST', body: '{}' }),
                    )
                  }
                >
                  <RotateCcw className="h-4 w-4" />
                  Keep subscription (renew period)
                </button>
              )}
              {sub && ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(sub.status) && (
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction('Subscription reactivated locally.', () =>
                      fetchApi('/subscription/reactivate', { method: 'POST', body: '{}' }),
                    )
                  }
                >
                  <RotateCcw className="h-4 w-4" />
                  Reactivate
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {info}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
