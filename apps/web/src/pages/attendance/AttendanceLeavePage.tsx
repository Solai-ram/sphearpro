import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, CalendarRange, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { attendanceApi } from '../../services/attendance';

const LEAVE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  APPROVED:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-800',       dot: 'bg-red-500'   },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-300' },
};

function daysBetween(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

export function AttendanceLeavePage() {
  const [rows, setRows]  = useState<any[]>([]);
  const [form, setForm]  = useState({ startDate: '', endDate: '', reason: '' });
  const [busy, setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await attendanceApi.myLeave());
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await attendanceApi.requestLeave({
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        reason: form.reason || undefined,
      });
      setForm({ startDate: '', endDate: '', reason: '' });
      setMsg('Leave request submitted successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this leave request?')) return;
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.cancelLeave(id);
      setMsg('Request cancelled.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const approved = rows.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/attendance" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Leave requests</h1>
          <p className="text-sm text-[var(--muted)]">Request and track your leave</p>
        </div>
      </div>

      {/* Alerts */}
      {msg   && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />{msg}</div>}
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><XCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-[var(--muted)]">Pending</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{approved}</p>
            <p className="text-xs text-[var(--muted)]">Approved</p>
          </div>
        </div>
      )}

      {/* Request form */}
      <form className="card space-y-3 p-4" onSubmit={submit}>
        <h2 className="text-sm font-semibold">New leave request</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Start date</span>
            <input
              type="date"
              required
              className="input mt-1 w-full"
              value={form.startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">End date</span>
            <input
              type="date"
              className="input mt-1 w-full"
              value={form.endDate}
              min={form.startDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </label>
        </div>
        {form.startDate && (
          <p className="text-xs text-[var(--muted)] flex items-center gap-1">
            <CalendarRange className="h-3 w-3" />
            {daysBetween(form.startDate, form.endDate || form.startDate)} day(s)
          </p>
        )}
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Reason (optional)</span>
          <textarea
            className="input mt-1 w-full"
            rows={2}
            placeholder="E.g. Medical appointment"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </label>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Submit request'}
        </button>
      </form>

      {/* Leave history list */}
      {rows.length > 0 && (
        <div className="card divide-y p-0">
          {rows.map((r) => {
            const s = LEAVE_STATUS[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' };
            const days = daysBetween(String(r.startDate), String(r.endDate));
            return (
              <div key={r.id} className="space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarRange className="h-4 w-4 text-[var(--muted)] shrink-0" />
                    {String(r.startDate).slice(0, 10)}
                    {r.endDate !== r.startDate && ` → ${String(r.endDate).slice(0, 10)}`}
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{days} day{days !== 1 ? 's' : ''}</span>
                  {r.reason && <span>· {r.reason}</span>}
                </div>
                {r.reviewNote && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Reviewer note: {r.reviewNote}
                  </p>
                )}
                {r.status === 'PENDING' && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => cancel(r.id)}
                  >
                    Cancel request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && !busy && (
        <div className="card py-10 text-center text-sm text-[var(--muted)]">
          No leave requests yet.
        </div>
      )}
    </div>
  );
}
