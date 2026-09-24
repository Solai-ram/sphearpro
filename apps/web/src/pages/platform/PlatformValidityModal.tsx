import { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ShieldCheck,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatDate } from '../subscription/types';
import { platformStatusTone } from './PlatformClinicCard';

export type PlatformValidityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
  clinicName: string;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
  status: string;
  onSuccess: (updatedSub?: any) => void;
};

const VALIDITY_PRESETS = [
  { label: '+7 Days', days: 7 },
  { label: '+15 Days', days: 15 },
  { label: '+30 Days (1 Mo)', days: 30 },
  { label: '+90 Days (3 Mo)', days: 90 },
  { label: '+180 Days (6 Mo)', days: 180 },
  { label: '+365 Days (1 Yr)', days: 365 },
];

const GRACE_PRESETS = [
  { label: '+3 Days', days: 3 },
  { label: '+7 Days (1 Wk)', days: 7 },
  { label: '+14 Days (2 Wks)', days: 14 },
  { label: '+30 Days (1 Mo)', days: 30 },
];

export function PlatformValidityModal({
  isOpen,
  onClose,
  subscriptionId,
  clinicName,
  currentPeriodEnd,
  gracePeriodEnd,
  status,
  onSuccess,
}: PlatformValidityModalProps) {
  const [activeTab, setActiveTab] = useState<'validity' | 'grace'>('validity');
  const [validityDays, setValidityDays] = useState<number>(30);
  const [graceDays, setGraceDays] = useState<number>(7);
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculate projected validity date
  const projectedPeriodEnd = useMemo(() => {
    const now = new Date();
    const base = currentPeriodEnd && new Date(currentPeriodEnd) > now
      ? new Date(currentPeriodEnd)
      : now;
    const target = new Date(base.getTime() + validityDays * 86400000);
    return target.toISOString();
  }, [currentPeriodEnd, validityDays]);

  // Calculate projected grace date
  const projectedGraceEnd = useMemo(() => {
    const now = new Date();
    const base = gracePeriodEnd && new Date(gracePeriodEnd) > now
      ? new Date(gracePeriodEnd)
      : now;
    const target = new Date(base.getTime() + graceDays * 86400000);
    return target.toISOString();
  }, [gracePeriodEnd, graceDays]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setBusy(true);

    try {
      if (activeTab === 'validity') {
        const payload = {
          days: validityDays,
          reason: reason.trim() || 'Platform validity extension',
        };
        const updated = await fetchApi(`/admin/subscriptions/${subscriptionId}/extend`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg(`Successfully extended validity by ${validityDays} days!`);
        setTimeout(() => {
          onSuccess(updated);
          onClose();
        }, 800);
      } else {
        const payload = {
          days: graceDays,
          reason: reason.trim() || 'Platform grace period granted',
        };
        const updated = await fetchApi(`/admin/subscriptions/${subscriptionId}/grace-period`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg(`Successfully granted ${graceDays} days grace period!`);
        setTimeout(() => {
          onSuccess(updated);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setError(err?.message || 'Operation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl ring-1 ring-white/10 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 p-5 bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Manage Subscription Validity
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${platformStatusTone(
                  status,
                )}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Clinic: <strong className="text-slate-200">{clinicName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('validity');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition ${
              activeTab === 'validity'
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Increase Validity
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('grace');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition ${
              activeTab === 'grace'
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Add Grace Period
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {activeTab === 'validity' ? (
            <>
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200/90 leading-relaxed flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  Extending validity pushes the active subscription expiration date forward. If the clinic was expired, suspended, or in grace, it will be restored to <strong>ACTIVE</strong> immediately.
                </span>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Select Quick Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {VALIDITY_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setValidityDays(p.days)}
                      className={`rounded-lg py-2 px-2.5 text-xs font-medium text-center border transition ${
                        validityDays === p.days
                          ? 'border-sky-500 bg-sky-500/20 text-sky-200 font-semibold ring-1 ring-sky-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom days input */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Custom Days</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={validityDays}
                    onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Projected Period Preview */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Current Period End:</span>
                  <span className="font-medium text-slate-200">{formatDate(currentPeriodEnd)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-sky-300">
                    <ArrowRight className="h-3.5 w-3.5 text-sky-400" />
                    New Period End:
                  </span>
                  <span className="text-emerald-300 text-sm">{formatDate(projectedPeriodEnd)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Grants full HIS software access during payment grace. Staff can login and operate uninterrupted while financial or billing issues are resolved.
                </span>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Select Grace Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GRACE_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setGraceDays(p.days)}
                      className={`rounded-lg py-2 px-2.5 text-xs font-medium text-center border transition ${
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

              {/* Custom days input */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Custom Grace Days</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={graceDays}
                    onChange={(e) => setGraceDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Projected Grace Preview */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Current Grace End:</span>
                  <span className="font-medium text-slate-200">{gracePeriodEnd ? formatDate(gracePeriodEnd) : 'None'}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                    New Grace Deadline:
                  </span>
                  <span className="text-amber-300 text-sm">{formatDate(projectedGraceEnd)}</span>
                </div>
              </div>
            </>
          )}

          {/* Reason input */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Audit Note / Reason <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                activeTab === 'validity'
                  ? 'e.g., Annual renewal incentive, VIP customer'
                  : 'e.g., Awaiting cheque clearance, NEFT payment'
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition disabled:opacity-50 ${
                activeTab === 'validity'
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400 ring-1 ring-sky-400/50'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-1 ring-amber-400/50'
              }`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {activeTab === 'validity'
                ? `Extend Validity (+${validityDays}d)`
                : `Grant Grace Period (+${graceDays}d)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
