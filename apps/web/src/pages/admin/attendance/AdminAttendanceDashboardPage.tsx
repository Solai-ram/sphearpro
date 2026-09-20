import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Pencil, RefreshCw, Settings, Smartphone, BarChart2, CalendarOff, Search } from 'lucide-react';
import { attendanceApi } from '../../../services/attendance';

const STATUS_META: Record<string, { label: string; cls: string; bg: string }> = {
  PRESENT:    { label: 'Present',    cls: 'text-emerald-700', bg: 'bg-emerald-100' },
  LATE:       { label: 'Late',       cls: 'text-amber-700',   bg: 'bg-amber-100'   },
  ABSENT:     { label: 'Absent',     cls: 'text-red-700',     bg: 'bg-red-100'     },
  ON_LEAVE:   { label: 'On leave',   cls: 'text-sky-700',     bg: 'bg-sky-100'     },
  HALF_DAY:   { label: 'Half day',   cls: 'text-violet-700',  bg: 'bg-violet-100'  },
  HOLIDAY:    { label: 'Holiday',    cls: 'text-teal-700',    bg: 'bg-teal-100'    },
  WEEK_OFF:   { label: 'Week off',   cls: 'text-slate-500',   bg: 'bg-slate-100'   },
  NOT_MARKED: { label: 'Not marked', cls: 'text-slate-400',   bg: 'bg-slate-50'    },
};

const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF'] as const;

function StatusBadge({ status }: { status?: string }) {
  const s = status ? (STATUS_META[status] ?? { label: status, cls: 'text-slate-500', bg: 'bg-slate-100' }) : STATUS_META['NOT_MARKED'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls} ${s.bg}`}>
      {s.label}
    </span>
  );
}

const STAT_CARDS = [
  { key: 'present',   label: 'Present',    gradFrom: '#10b981', gradTo: '#059669' },
  { key: 'late',      label: 'Late',       gradFrom: '#f59e0b', gradTo: '#d97706' },
  { key: 'absent',    label: 'Absent',     gradFrom: '#ef4444', gradTo: '#dc2626' },
  { key: 'onLeave',   label: 'On leave',   gradFrom: '#38bdf8', gradTo: '#0ea5e9' },
  { key: 'notMarked', label: 'Not marked', gradFrom: '#94a3b8', gradTo: '#64748b' },
];

export function AdminAttendanceDashboardPage() {
  const [date, setDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [dash, setDash]   = useState<any>(null);
  const [list, setList]   = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit]   = useState<any | null>(null);
  const [form, setForm]   = useState({ status: 'PRESENT', checkIn: '', checkOut: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (s?: string, st?: string) => {
    setLoading(true);
    setError(null);
    try {
      const searchVal = s !== undefined ? s : search;
      const statusVal = st !== undefined ? st : filterStatus;
      const [d, l] = await Promise.all([
        attendanceApi.dashboard(date),
        attendanceApi.list({ date, search: searchVal || undefined, status: statusVal || undefined }),
      ]);
      setDash(d);
      setList(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date, filterStatus]);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(val, filterStatus), 400);
  };

  const openEdit = (row: any) => {
    setEdit(row);
    const a = row.attendance;
    setForm({
      status: a?.status || 'PRESENT',
      checkIn: a?.checkIn ? new Date(a.checkIn).toISOString().slice(0, 16) : `${date}T09:00`,
      checkOut: a?.checkOut ? new Date(a.checkOut).toISOString().slice(0, 16) : '',
      remarks: '',
    });
  };

  const saveManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || !form.remarks.trim()) {
      setError('Remarks are required for manual corrections.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await attendanceApi.manual({
        userId: edit.user.id,
        date,
        status: form.status,
        checkIn: form.checkIn ? new Date(form.checkIn).toISOString() : undefined,
        checkOut: form.checkOut ? new Date(form.checkOut).toISOString() : undefined,
        remarks: form.remarks.trim(),
      });
      setEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction failed');
    } finally {
      setSaving(false);
    }
  };

  const counts = dash?.counts || {};
  const rows: any[] = list?.data || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Attendance dashboard</h1>
          <p className="text-sm text-[var(--muted)]">Staff check-in status for the clinic</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/attendance/leave"    className="btn-secondary text-sm inline-flex items-center gap-1.5"><CalendarOff className="h-3.5 w-3.5" />Leave & holidays</Link>
          <Link to="/admin/attendance/settings" className="btn-secondary text-sm inline-flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Settings</Link>
          <Link to="/admin/attendance/devices"  className="btn-secondary text-sm inline-flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" />Devices</Link>
          <Link to="/admin/attendance/reports"  className="btn-secondary text-sm inline-flex items-center gap-1.5"><BarChart2 className="h-3.5 w-3.5" />Reports</Link>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Date + search + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="input pl-8 max-w-xs"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <button type="button" className="btn-ghost p-2" onClick={() => load()} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STAT_CARDS.map(({ key, label, gradFrom, gradTo }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            className={`card p-4 text-left transition hover:shadow-md ${filterStatus === key ? 'ring-2 ring-[var(--primary)]' : ''}`}
          >
            <p className="text-2xl font-bold" style={{ color: gradFrom }}>{counts[key] ?? '—'}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{label}</p>
            <div
              className="mt-2 h-1 rounded-full"
              style={{ background: `linear-gradient(to right, ${gradFrom}, ${gradTo})`, opacity: 0.5 }}
            />
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${!filterStatus ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          onClick={() => setFilterStatus('')}
        >
          All
        </button>
        {STATUSES.map((st) => {
          const m = STATUS_META[st];
          return (
            <button
              key={st}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterStatus === st ? `${m.bg} ${m.cls} ring-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setFilterStatus(filterStatus === st ? '' : st)}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Check-in</th>
                <th className="px-4 py-2.5">Check-out</th>
                <th className="px-4 py-2.5">Hours</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row: any) => (
                <tr key={row.user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{row.user.name}</p>
                    <p className="text-xs text-[var(--muted)]">{row.user.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{row.user.staffType || '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {row.attendance?.checkIn
                      ? new Date(row.attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {row.attendance?.checkOut
                      ? new Date(row.attendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">{row.attendance?.workingHoursDisplay || '—'}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={row.status} />
                    {row.attendance?.lateMinutes > 0 && (
                      <span className="ml-1 text-[10px] text-amber-600">{row.attendance.lateMinutes}m late</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="btn-ghost p-1.5 text-[var(--muted)] hover:text-[var(--text)]"
                      title="Correct attendance"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                    No staff records for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual correction modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="card w-full max-w-md space-y-4 p-5"
            onSubmit={saveManual}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold">Correct attendance</h2>
              <p className="text-sm text-[var(--muted)]">{edit.user.name} · {date}</p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Check-in</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Check-out</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.checkOut}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Remarks <span className="text-red-500">*</span></label>
              <textarea
                className="input min-h-[72px]"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                required
                placeholder="Reason for correction (required)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => { setEdit(null); setError(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save correction'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
