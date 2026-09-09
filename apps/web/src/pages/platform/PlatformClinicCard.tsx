import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  LogIn,
  Users,
  UserRound,
} from 'lucide-react';
import { formatDate, formatPaise, statusLabel } from '../subscription/types';
import { ClinicStorageMiniChart } from './PlatformCharts';
import { fetchApi, setAccessToken } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export type PlatformClinicCardData = {
  id: string;
  status: string;
  amountPaise: number;
  currency: string;
  billingInterval?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  clinic: {
    id: string;
    name: string;
    slug: string;
    email?: string | null;
    status?: string;
  };
  plan: {
    code: string;
    name: string;
    monthlyPricePaise?: number;
  };
  usage?: {
    users: number;
    patients: number;
    maxStaffUsers?: number;
    maxAdminUsers?: number;
    seatCap?: number;
    storageBytes?: number;
    storageDisplay?: string;
    storageFiles?: number;
    storagePercentOfDisk?: number;
    diskTotalBytes?: number | null;
    diskTotalDisplay?: string | null;
  };
  supportLogin?: {
    email: string;
    password: string;
    userId?: string;
  } | null;
};

export function platformStatusTone(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30';
    case 'TRIALING':
      return 'bg-sky-500/15 text-sky-300 ring-sky-500/30';
    case 'GRACE_PERIOD':
    case 'PAST_DUE':
    case 'PAYMENT_FAILED':
      return 'bg-amber-500/15 text-amber-300 ring-amber-500/30';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'bg-rose-500/15 text-rose-300 ring-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 ring-slate-500/30';
  }
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function PlatformClinicCard({ row }: { row: PlatformClinicCardData }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);

  const interval =
    row.billingInterval === 'YEARLY' ? 'yearly' : row.billingInterval === 'MONTHLY' ? 'monthly' : null;
  const seatCap =
    row.usage?.seatCap ??
    ((row.usage?.maxStaffUsers || 0) + (row.usage?.maxAdminUsers || 0) || null);
  const support = row.supportLogin;

  const markCopied = (kind: 'email' | 'password') => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const handleSupportLogin = async () => {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const result = await fetchApi<{ accessToken: string }>(
        `/admin/clinics/${row.clinic.id}/support-login`,
        { method: 'POST' },
      );
      if (!result.accessToken) throw new Error('Login response incomplete');
      setAccessToken(result.accessToken);
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Support login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-[0_8px_30px_rgb(0_0_0/0.25)] transition hover:border-sky-500/40 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/platform/subscriptions/${row.id}`} className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-100 group-hover:text-white">
                {row.clinic.name}
              </h3>
              <p className="truncate text-xs text-slate-400">{row.clinic.slug}</p>
            </div>
          </div>
        </Link>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${platformStatusTone(
            row.status,
          )}`}
        >
          {statusLabel(row.status)}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2 text-slate-300">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <CreditCard className="h-3.5 w-3.5" />
            Plan
          </span>
          <span className="truncate font-medium text-slate-100">{row.plan.name}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-300">
          <span className="text-slate-400">Billing</span>
          <span className="font-medium text-slate-100">
            {formatPaise(row.amountPaise, row.currency)}
            {interval ? (
              <span className="ml-1 text-xs font-normal text-slate-400">
                /{interval === 'yearly' ? 'yr' : 'mo'}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-300">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            Period end
          </span>
          <span className="font-medium text-slate-100">{formatDate(row.currentPeriodEnd)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
        <div className="rounded-xl bg-slate-950/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Users className="h-3 w-3" /> Users
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {row.usage?.users ?? '—'}
            {seatCap ? <span className="text-sm font-normal text-slate-500"> / {seatCap}</span> : null}
          </p>
        </div>
        <div className="rounded-xl bg-slate-950/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <UserRound className="h-3 w-3" /> Patients
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{row.usage?.patients ?? '—'}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-950/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <HardDrive className="h-3 w-3" /> VPS data
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {row.usage?.storageDisplay ?? '0 B'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {row.usage?.storageFiles ?? 0} files
            {row.usage?.diskTotalDisplay
              ? ` · ${row.usage.storagePercentOfDisk ?? 0}% of ${row.usage.diskTotalDisplay}`
              : null}
          </p>
        </div>
        <div className="w-[88px] shrink-0">
          <ClinicStorageMiniChart
            storageBytes={row.usage?.storageBytes ?? 0}
            diskTotalBytes={row.usage?.diskTotalBytes}
          />
        </div>
      </div>

      {support && (
        <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            <KeyRound className="h-3 w-3" />
            Your access for this clinic
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Platform owner login — open this clinic with full admin rights. Not a clinic user seat.
          </p>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-slate-500">Email</span>
              <code className="min-w-0 flex-1 truncate rounded bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200">
                {support.email}
              </code>
              <button
                type="button"
                title="Copy email"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() =>
                  void copyText(support.email).then((ok) => ok && markCopied('email'))
                }
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-slate-500">Pass</span>
              <code className="min-w-0 flex-1 truncate rounded bg-slate-950/70 px-2 py-1 font-mono text-[11px] text-slate-200">
                {showPassword ? support.password : '•'.repeat(Math.min(14, support.password.length))}
              </code>
              <button
                type="button"
                title={showPassword ? 'Hide password' : 'Show password'}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                title="Copy password"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() =>
                  void copyText(support.password).then((ok) => ok && markCopied('password'))
                }
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {copied && (
              <p className="text-[10px] text-emerald-400">
                {copied === 'email' ? 'Email' : 'Password'} copied
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={loggingIn}
            onClick={() => void handleSupportLogin()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {loggingIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loggingIn ? 'Opening clinic…' : 'Enter clinic as platform admin'}
          </button>
          {loginError && <p className="mt-2 text-xs text-rose-300">{loginError}</p>}
        </div>
      )}

      {row.clinic.email && (
        <p className="mt-3 truncate text-xs text-slate-500">{row.clinic.email}</p>
      )}
      {row.cancelAtPeriodEnd && (
        <p className="mt-2 text-xs font-medium text-amber-300">Cancels at period end</p>
      )}
    </article>
  );
}

export function UsageMeter({
  label,
  usedDisplay,
  freeDisplay,
  totalDisplay,
  usedPercent,
  tone = 'sky',
  chart,
}: {
  label: string;
  usedDisplay: string;
  freeDisplay: string;
  totalDisplay: string;
  usedPercent: number;
  tone?: 'sky' | 'violet' | 'amber';
  chart?: React.ReactNode;
}) {
  const bar =
    tone === 'amber' ? 'bg-amber-400' : tone === 'violet' ? 'bg-violet-400' : 'bg-sky-400';
  const pct = Math.min(100, Math.max(0, usedPercent));
  const warn = pct >= 85;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
            {usedDisplay}
            <span className="ml-1 text-sm font-normal text-slate-400">used</span>
          </p>
        </div>
        <span className={`text-sm font-semibold ${warn ? 'text-amber-300' : 'text-slate-300'}`}>
          {pct}%
        </span>
      </div>
      {chart ? <div className="mt-1">{chart}</div> : null}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${warn ? 'bg-amber-400' : bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-xs text-slate-400">
        <span>{freeDisplay} free</span>
        <span>{totalDisplay} total</span>
      </div>
    </div>
  );
}
