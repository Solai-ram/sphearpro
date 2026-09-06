import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { usePlatformLoad } from './PlatformLayout';
import { PlatformClinicCard, type PlatformClinicCardData } from './PlatformClinicCard';

type ListResponse = {
  total: number;
  items: PlatformClinicCardData[];
};

export function PlatformSubscriptionsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState({ search: '', status: '' });

  const { data, loading, error } = usePlatformLoad<ListResponse>(
    () => {
      const params = new URLSearchParams();
      if (q.search) params.set('search', q.search);
      if (q.status) params.set('status', q.status);
      params.set('limit', '50');
      return fetchApi(`/admin/subscriptions?${params}`);
    },
    [q.search, q.status],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Clinics</h2>
          <p className="mt-1 text-sm text-slate-400">
            Each card shows subscription status, seats, and patient count
          </p>
        </div>
        {data && <p className="text-xs text-slate-500">{data.total} subscriptions</p>}
      </div>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ({ search, status });
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="Search clinic name or slug"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            'ACTIVE',
            'TRIALING',
            'GRACE_PERIOD',
            'PAST_DUE',
            'PAYMENT_FAILED',
            'EXPIRED',
            'CANCELLED',
            'SUSPENDED',
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      {loading && (
        <div className="mt-12 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((row) => (
            <PlatformClinicCard key={row.id} row={row} />
          ))}
          {data.items.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-slate-500">
              No clinics match this filter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
