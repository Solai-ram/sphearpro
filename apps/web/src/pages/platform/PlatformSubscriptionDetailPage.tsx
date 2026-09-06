import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { usePlatformLoad } from './PlatformLayout';
import { formatDate, formatPaise, statusLabel } from '../subscription/types';
import { platformStatusTone } from './PlatformClinicCard';

export function PlatformSubscriptionDetailPage() {
  const { id } = useParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [reason, setReason] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading, error } = usePlatformLoad<any>(
    () => fetchApi(`/admin/subscriptions/${id}`),
    [id, reloadKey],
  );

  async function action(path: string, body: Record<string, unknown>, okMsg: string) {
    if (!id) return;
    setBusy(true);
    setMessage(null);
    try {
      await fetchApi(`/admin/subscriptions/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage(okMsg);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setMessage(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error || 'Not found'}
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/platform/subscriptions"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        All clinics
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{data.clinic?.name}</h2>
          <p className="text-sm text-slate-400">
            {data.clinic?.slug} · {data.plan?.name}
            {data.clinic?.email ? ` · ${data.clinic.email}` : ''}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${platformStatusTone(
            data.status,
          )}`}
        >
          {statusLabel(data.status)}
        </span>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Amount', formatPaise(data.amountPaise, data.currency)],
          ['Period end', formatDate(data.currentPeriodEnd)],
          ['Provider', String(data.provider ?? '—')],
          ['Seats', `${data.plan?.maxStaffUsers ?? '—'} staff + ${data.plan?.maxAdminUsers ?? '—'} admin`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-2 text-sm font-medium text-slate-100">{String(value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 font-mono text-xs text-slate-500">
        Provider sub: {data.providerSubscriptionId || '—'}
      </p>

      <section className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
        <h3 className="text-sm font-semibold text-white">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['suspend', 'Suspend', { reason: reason || 'platform suspend' }, 'Suspended'],
              ['reactivate', 'Reactivate', { reason: reason || 'platform reactivate' }, 'Reactivated'],
              [
                'offline-payment',
                'Offline payment',
                { note: reason || 'Offline payment', amountPaise: data.amountPaise },
                'Offline payment recorded',
              ],
            ] as Array<[string, string, Record<string, unknown>, string]>
          ).map(([path, label, body, ok]) => (
            <button
              key={path}
              type="button"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void action(path, body, ok)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-4">
          <div>
            <label className="text-xs text-slate-500">Extend days</label>
            <input
              type="number"
              min={1}
              className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-slate-500">Reason (required for extend)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Support ticket / goodwill"
            />
          </div>
          <button
            type="button"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            disabled={busy || !reason.trim()}
            onClick={() =>
              void action('extend', { days: extendDays, reason: reason.trim() }, `Extended ${extendDays} days`)
            }
          >
            Extend
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-slate-400">{message}</p>}
      </section>

      <h3 className="mt-8 text-sm font-semibold text-white">Recent events</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {(data.events || []).slice(0, 15).map((ev: any) => (
          <li key={ev.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-400">
            <span className="font-medium text-slate-200">{ev.eventType}</span>
            {' · '}
            {formatDate(ev.createdAt)}
            {ev.oldStatus ? ` · ${ev.oldStatus} → ${ev.newStatus}` : ''}
          </li>
        ))}
        {(data.events || []).length === 0 && <li className="text-slate-500">No events</li>}
      </ul>
    </div>
  );
}
