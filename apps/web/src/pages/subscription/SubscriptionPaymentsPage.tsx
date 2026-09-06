import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import {
  type SubscriptionPaymentRow,
  formatDate,
  formatPaise,
  statusBadgeClass,
  statusLabel,
} from './types';

export function SubscriptionPaymentsPage() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<SubscriptionPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = hasRole('ADMIN', 'CLINIC_ADMIN');

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchApi<SubscriptionPaymentRow[]>('/subscription/payments');
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load payments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-[var(--muted)]">
        Admin only.{' '}
        <Link to="/dashboard" className="underline">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-1">
      <Link
        to="/subscription"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Billing home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Subscription payments</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">SaaS charges only — not patient clinic invoices.</p>

      {loading && (
        <div className="mt-10 flex justify-center text-[var(--muted)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--app-bg)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Provider payment</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{formatDate(row.paidAt || row.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatPaise(row.amountPaise, row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                        row.status,
                      )}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {row.providerPaymentId || '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.failureReason || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    No SaaS payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
