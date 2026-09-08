import { Link } from 'react-router-dom';
import { Loader2, Server, Users, Building2, Activity } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { usePlatformLoad } from './PlatformLayout';
import { PlatformClinicCard, UsageMeter, type PlatformClinicCardData } from './PlatformClinicCard';
import {
  ResourceCompareBarChart,
  ResourceDonutChart,
  SubscriptionStatusChart,
  DiskBreakdownChart,
} from './PlatformCharts';

type DiskBreakdownItem = {
  key: 'database' | 'application' | 'os' | 'free' | string;
  label: string;
  bytes: number;
  display: string;
  percentOfDisk: number;
  available?: boolean;
  hint?: string;
};

type Infra = {
  hostname: string;
  platform: string;
  arch: string;
  uptimeDisplay: string;
  cpuCount: number;
  nodeVersion: string;
  loadAverage?: { one: number; five: number; fifteen: number };
  disk: {
    path: string;
    usedPercent: number;
    usedDisplay: string;
    freeDisplay: string;
    totalDisplay: string;
  } | null;
  diskBreakdown?: {
    totalDisplay: string;
    usedDisplay: string;
    items: DiskBreakdownItem[];
    notes?: string[];
  };
  memory: {
    usedPercent: number;
    usedDisplay: string;
    freeDisplay: string;
    totalDisplay: string;
  };
};

type Kpis = {
  clinicsTotal: number;
  usersTotal: number;
  patientsTotal: number;
  subscriptionsByStatus: {
    active: number;
    trialing: number;
    pastDue: number;
    paymentFailed: number;
    grace: number;
    expired: number;
    cancelled: number;
    suspended: number;
  };
  mrrDisplay: string;
  paymentsThisMonthDisplay: string;
  failedPaymentsThisMonth: number;
  infrastructure: Infra;
};

type ListResponse = {
  total: number;
  items: PlatformClinicCardData[];
};

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

export function PlatformDashboardPage() {
  const kpis = usePlatformLoad<Kpis>(() => fetchApi('/admin/subscriptions/kpis'), []);
  const clinics = usePlatformLoad<ListResponse>(
    () => fetchApi('/admin/subscriptions?limit=24'),
    [],
  );

  if (kpis.loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (kpis.error || !kpis.data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {kpis.error || 'Failed to load KPIs'}
      </div>
    );
  }

  const data = kpis.data;
  const s = data.subscriptionsByStatus;
  const infra = data.infrastructure;
  const diskPct = infra?.disk?.usedPercent ?? 0;
  const memPct = infra?.memory?.usedPercent ?? 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Overview</h2>
          <p className="mt-1 text-sm text-slate-400">
            Clinics, subscriptions, and host resources
            {infra?.hostname ? (
              <span className="text-slate-500"> · {infra.hostname}</span>
            ) : null}
          </p>
        </div>
        <Link
          to="/platform/subscriptions"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
        >
          All clinics
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clinics" value={data.clinicsTotal} icon={Building2} />
        <Stat label="Users (all clinics)" value={data.usersTotal} icon={Users} />
        <Stat label="MRR" value={data.mrrDisplay} icon={Activity} />
        <Stat label="Payments this month" value={data.paymentsThisMonthDisplay} icon={Activity} />
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            VPS / host resources
          </h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {infra?.disk ? (
            <UsageMeter
              label={`Disk · ${infra.disk.path}`}
              usedDisplay={infra.disk.usedDisplay}
              freeDisplay={infra.disk.freeDisplay}
              totalDisplay={infra.disk.totalDisplay}
              usedPercent={infra.disk.usedPercent}
              tone={infra.disk.usedPercent >= 85 ? 'amber' : 'sky'}
              chart={
                <ResourceDonutChart
                  usedPercent={infra.disk.usedPercent}
                  usedLabel="Used"
                  freeLabel="Free"
                  color="#38bdf8"
                  warn={infra.disk.usedPercent >= 85}
                />
              }
            />
          ) : (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 text-sm text-slate-400">
              Disk metrics unavailable on this host.
            </div>
          )}
          {infra?.memory && (
            <UsageMeter
              label="Memory (RAM)"
              usedDisplay={infra.memory.usedDisplay}
              freeDisplay={infra.memory.freeDisplay}
              totalDisplay={infra.memory.totalDisplay}
              usedPercent={infra.memory.usedPercent}
              tone="violet"
              chart={
                <ResourceDonutChart
                  usedPercent={infra.memory.usedPercent}
                  usedLabel="Used"
                  freeLabel="Free"
                  color="#a78bfa"
                  warn={infra.memory.usedPercent >= 85}
                />
              }
            />
          )}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Runtime</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Uptime</dt>
                <dd className="font-medium text-slate-100">{infra?.uptimeDisplay || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">CPUs</dt>
                <dd className="font-medium text-slate-100">{infra?.cpuCount || '—'}</dd>
              </div>
              {infra?.loadAverage && infra.platform !== 'win32' ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Load (1/5/15)</dt>
                  <dd className="font-medium text-slate-100">
                    {infra.loadAverage.one} / {infra.loadAverage.five} / {infra.loadAverage.fifteen}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">OS</dt>
                <dd className="font-medium text-slate-100">
                  {infra?.platform}/{infra?.arch}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Node</dt>
                <dd className="font-medium text-slate-100">{infra?.nodeVersion || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Patients (all)</dt>
                <dd className="font-medium text-slate-100">{data.patientsTotal}</dd>
              </div>
            </dl>
          </div>
        </div>

        {infra?.diskBreakdown?.items?.length ? (
          <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Disk usage details
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Breakdown of host volume
                  {infra.diskBreakdown.totalDisplay
                    ? ` · ${infra.diskBreakdown.usedDisplay} used of ${infra.diskBreakdown.totalDisplay}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <DiskBreakdownChart items={infra.diskBreakdown.items} />
              <div className="space-y-3">
                {infra.diskBreakdown.items.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="font-medium text-slate-100">
                        {item.display}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {item.percentOfDisk}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.percentOfDisk))}%`,
                          background:
                            item.key === 'database'
                              ? '#38bdf8'
                              : item.key === 'application'
                                ? '#a78bfa'
                                : item.key === 'os'
                                  ? '#fbbf24'
                                  : '#475569',
                        }}
                      />
                    </div>
                    {item.hint ? (
                      <p className="mt-1 text-[11px] text-slate-500">{item.hint}</p>
                    ) : null}
                  </div>
                ))}
                {infra.diskBreakdown.notes?.length ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                    {infra.diskBreakdown.notes.map((note) => (
                      <li key={note}>· {note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resource usage
            </p>
            <p className="mt-1 text-sm text-slate-500">Disk vs memory utilization</p>
            <div className="mt-2">
              <ResourceCompareBarChart diskPercent={diskPct} memoryPercent={memPct} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Subscription mix
            </p>
            <p className="mt-1 text-sm text-slate-500">Clinics by subscription status</p>
            <div className="mt-2">
              <SubscriptionStatusChart status={s} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Subscription status
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Active', s.active],
            ['Trialing', s.trialing],
            ['Grace', s.grace],
            ['Past due', s.pastDue],
            ['Payment failed', s.paymentFailed],
            ['Expired', s.expired],
            ['Cancelled', s.cancelled],
            ['Suspended', s.suspended],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Clinics</h3>
            <p className="text-sm text-slate-400">Subscription and usage at a glance</p>
          </div>
          {!clinics.loading && clinics.data && (
            <p className="text-xs text-slate-500">{clinics.data.total} total</p>
          )}
        </div>

        {clinics.loading && (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {clinics.error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {clinics.error}
          </div>
        )}
        {!clinics.loading && clinics.data && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clinics.data.items.map((row) => (
              <PlatformClinicCard key={row.id} row={row} />
            ))}
            {clinics.data.items.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-slate-500">
                No clinic subscriptions yet.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
