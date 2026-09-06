import { Loader2 } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { usePlatformLoad } from './PlatformLayout';
import { formatDate, formatPaise, statusLabel } from '../subscription/types';
import { platformStatusTone } from './PlatformClinicCard';

function DarkTableShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/80">
        {children}
      </div>
    </div>
  );
}

export function PlatformPaymentsPage() {
  const { data, loading, error } = usePlatformLoad<{
    items: Array<{
      id: string;
      amountPaise: number;
      currency: string;
      status: string;
      createdAt: string;
      clinic: { name: string; slug: string };
    }>;
    total: number;
  }>(() => fetchApi('/admin/payments?limit=50'), []);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="text-sm text-rose-300">{error}</div>;
  }

  return (
    <DarkTableShell title="SaaS payments">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Clinic</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
              <td className="px-4 py-3 text-slate-100">
                {row.clinic.name}
                <div className="text-xs text-slate-500">{row.clinic.slug}</div>
              </td>
              <td className="px-4 py-3 text-slate-200">{formatPaise(row.amountPaise, row.currency)}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ring-1 ${platformStatusTone(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DarkTableShell>
  );
}

export function PlatformInvoicesPage() {
  const { data, loading, error } = usePlatformLoad<{
    items: Array<{
      id: string;
      invoiceNumber: string;
      totalAmountPaise: number;
      currency: string;
      status: string;
      invoiceDate: string;
      clinic: { name: string };
    }>;
  }>(() => fetchApi('/admin/invoices?limit=50'), []);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="text-sm text-rose-300">{error}</div>;
  }

  return (
    <DarkTableShell title="SaaS invoices">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Clinic</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-100">{row.invoiceNumber}</td>
              <td className="px-4 py-3 text-slate-300">{row.clinic.name}</td>
              <td className="px-4 py-3 text-slate-200">
                {formatPaise(row.totalAmountPaise, row.currency)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ring-1 ${platformStatusTone(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">{formatDate(row.invoiceDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DarkTableShell>
  );
}

export function PlatformWebhooksPage() {
  const { data, loading, error } = usePlatformLoad<{
    items: Array<{
      id: string;
      eventId: string;
      eventType: string;
      processed: boolean;
      errorMessage?: string | null;
      createdAt: string;
    }>;
  }>(() => fetchApi('/admin/webhooks?limit=50'), []);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="text-sm text-rose-300">{error}</div>;
  }

  return (
    <DarkTableShell title="Webhook events">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Event id</th>
            <th className="px-4 py-3">Processed</th>
            <th className="px-4 py-3">Error</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-100">{row.eventType}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.eventId}</td>
              <td className="px-4 py-3 text-slate-300">{row.processed ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3 text-xs text-rose-300">{row.errorMessage || '—'}</td>
              <td className="px-4 py-3 text-slate-400">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DarkTableShell>
  );
}
