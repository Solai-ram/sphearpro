import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { usePlatformLoad } from './PlatformLayout';
import { formatDate, formatPaise, statusLabel } from '../subscription/types';
import { platformStatusTone } from './PlatformClinicCard';

const VALIDITY_PRESETS = [
  { label: '+7d', days: 7 },
  { label: '+15d', days: 15 },
  { label: '+30d (1 Mo)', days: 30 },
  { label: '+90d (3 Mo)', days: 90 },
  { label: '+180d (6 Mo)', days: 180 },
  { label: '+365d (1 Yr)', days: 365 },
];

const GRACE_PRESETS = [
  { label: '+3d', days: 3 },
  { label: '+7d (1 Wk)', days: 7 },
  { label: '+14d (2 Wks)', days: 14 },
  { label: '+30d (1 Mo)', days: 30 },
];

export function PlatformSubscriptionDetailPage() {
  const { id } = useParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMsg, setIsErrorMsg] = useState(false);

  // Extend validity state
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState('');

  // Grace period state
  const [graceDays, setGraceDays] = useState(7);
  const [graceReason, setGraceReason] = useState('');

  // General action reason
  const [actionReason, setActionReason] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading, error } = usePlatformLoad<any>(
    () => fetchApi(`/admin/subscriptions/${id}`),
    [id, reloadKey],
  );

  // Projected validity date
  const projectedPeriodEnd = useMemo(() => {
    const now = new Date();
    const base = data?.currentPeriodEnd && new Date(data.currentPeriodEnd) > now
      ? new Date(data.currentPeriodEnd)
      : now;
    const target = new Date(base.getTime() + extendDays * 86400000);
    return target.toISOString();
  }, [data?.currentPeriodEnd, extendDays]);

  // Projected grace date
  const projectedGraceEnd = useMemo(() => {
    const now = new Date();
    const base = data?.gracePeriodEnd && new Date(data.gracePeriodEnd) > now
      ? new Date(data.gracePeriodEnd)
      : now;
    const target = new Date(base.getTime() + graceDays * 86400000);
    return target.toISOString();
  }, [data?.gracePeriodEnd, graceDays]);

  async function action(path: string, body: Record<string, unknown>, okMsg: string) {
    if (!id) return;
    setBusy(true);
    setMessage(null);
    setIsErrorMsg(false);
    try {
      await fetchApi(`/admin/subscriptions/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage(okMsg);
      setIsErrorMsg(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setMessage(e?.message || 'Action failed');
      setIsErrorMsg(true);
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
    <div className="space-y-8">
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
      </div>

      {/* Subscription stats summary */}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Amount', formatPaise(data.amountPaise, data.currency)],
          ['Period end', formatDate(data.currentPeriodEnd)],
          ['Grace period end', data.gracePeriodEnd ? formatDate(data.gracePeriodEnd) : 'None'],
          ['Provider', String(data.provider ?? '—')],
          ['Seats', `${data.plan?.maxStaffUsers ?? '—'} staff + ${data.plan?.maxAdminUsers ?? '—'} admin`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-2 text-sm font-medium text-slate-100">{String(value)}</dd>
          </div>
        ))}
      </dl>

      <p className="font-mono text-xs text-slate-500">
        Provider sub: {data.providerSubscriptionId || '—'}
      </p>

      {/* Status feedback message */}
      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            isErrorMsg
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {message}
        </div>
      )}

      {/* Validity & Grace Management Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Increase Validity */}
        <section className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center gap-2 text-sky-400">
            <Calendar className="h-5 w-5" />
            <h3 className="text-base font-semibold text-white">Increase Validity / Extend</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Adds days to the active billing cycle. If expired, suspended, or in grace, restoring validity sets status back to <strong className="text-sky-300">ACTIVE</strong>.
          </p>

          <div className="mt-4 space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Quick Duration Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {VALIDITY_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setExtendDays(p.days)}
                    className={`rounded-lg py-1.5 px-2 text-xs font-medium text-center border transition ${
                      extendDays === p.days
                        ? 'border-sky-500 bg-sky-500/20 text-sky-200 font-semibold ring-1 ring-sky-500/30'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Days Input */}
            <div className="flex items-center gap-3">
              <div className="w-32">
                <label className="block text-xs text-slate-400 mb-1">Custom Days</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={extendDays}
                  onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Reason (Optional)</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g., Annual renewal incentive, support ticket"
                />
              </div>
            </div>

            {/* Projected Date Preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Current End:</span>
                <span className="font-medium text-slate-200">{formatDate(data.currentPeriodEnd)}</span>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-sky-300">
                  <ArrowRight className="h-3 w-3 text-sky-400" />
                  New Validity End:
                </span>
                <span className="text-emerald-300 text-sm">{formatDate(projectedPeriodEnd)}</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
              disabled={busy}
              onClick={() =>
                void action(
                  'extend',
                  { days: extendDays, reason: extendReason.trim() || 'Platform validity extension' },
                  `Extended validity by ${extendDays} days`,
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Extend Validity (+{extendDays} days)
            </button>
          </div>
        </section>

        {/* Card 2: Grant Grace Period */}
        <section className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock className="h-5 w-5" />
            <h3 className="text-base font-semibold text-white">Add / Extend Grace Period</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Grants full HIS software login and clinical workflows during billing issues or pending cheque/NEFT clearance.
          </p>

          <div className="mt-4 space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Quick Grace Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GRACE_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setGraceDays(p.days)}
                    className={`rounded-lg py-1.5 px-2 text-xs font-medium text-center border transition ${
                      graceDays === p.days
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200 font-semibold ring-1 ring-amber-500/30'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Days Input */}
            <div className="flex items-center gap-3">
              <div className="w-32">
                <label className="block text-xs text-slate-400 mb-1">Custom Days</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                  value={graceDays}
                  onChange={(e) => setGraceDays(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Reason (Optional)</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  value={graceReason}
                  onChange={(e) => setGraceReason(e.target.value)}
                  placeholder="e.g., Awaiting cheque clearance, NEFT payment"
                />
              </div>
            </div>

            {/* Projected Date Preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Current Grace End:</span>
                <span className="font-medium text-slate-200">{data.gracePeriodEnd ? formatDate(data.gracePeriodEnd) : 'None'}</span>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <ArrowRight className="h-3 w-3 text-amber-400" />
                  New Grace Deadline:
                </span>
                <span className="text-amber-300 text-sm">{formatDate(projectedGraceEnd)}</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
              disabled={busy}
              onClick={() =>
                void action(
                  'grace-period',
                  { days: graceDays, reason: graceReason.trim() || 'Platform grace period granted' },
                  `Granted ${graceDays} days grace period`,
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Grant Grace Period (+{graceDays} days)
            </button>
          </div>
        </section>
      </div>

      {/* Other Administrative Actions */}
      <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
        <h3 className="text-sm font-semibold text-white">Other Subscription Actions</h3>
        <p className="mt-1 text-xs text-slate-400">
          Reactivate suspended accounts, temporarily suspend clinic access, or record offline payment.
        </p>

        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <input
            className="w-72 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Audit reason for action…"
          />

          {(
            [
              ['suspend', 'Suspend Clinic', { reason: actionReason || 'platform suspend' }, 'Clinic suspended'],
              ['reactivate', 'Reactivate Clinic', { reason: actionReason || 'platform reactivate' }, 'Clinic reactivated'],
              [
                'offline-payment',
                'Record Offline Payment',
                { note: actionReason || 'Offline payment', amountPaise: data.amountPaise },
                'Offline payment recorded and activated',
              ],
            ] as Array<[string, string, Record<string, unknown>, string]>
          ).map(([path, label, body, ok]) => (
            <button
              key={path}
              type="button"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50 transition"
              disabled={busy}
              onClick={() => void action(path, body, ok)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent events timeline */}
      <section>
        <h3 className="text-sm font-semibold text-white">Recent Subscription Events</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.events || []).slice(0, 15).map((ev: any) => (
            <li key={ev.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-slate-400">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{ev.eventType}</span>
                <span>{formatDate(ev.createdAt)}</span>
              </div>
              {ev.oldStatus ? (
                <p className="mt-1 text-xs text-slate-400">
                  Status transition: <span className="text-slate-300 font-mono">{ev.oldStatus}</span> →{' '}
                  <span className="text-emerald-300 font-mono">{ev.newStatus}</span>
                </p>
              ) : null}
              {ev.metadata?.reason ? (
                <p className="mt-1 text-xs text-slate-400">
                  Reason: <span className="text-slate-300">{ev.metadata.reason}</span>
                </p>
              ) : null}
              {ev.metadata?.days ? (
                <p className="mt-0.5 text-xs text-slate-500">Duration: {ev.metadata.days} days</p>
              ) : null}
            </li>
          ))}
          {(data.events || []).length === 0 && <li className="text-slate-500">No events found.</li>}
        </ul>
      </section>
    </div>
  );
}
