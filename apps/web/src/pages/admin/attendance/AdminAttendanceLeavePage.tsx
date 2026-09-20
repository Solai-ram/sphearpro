import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, CheckCircle2, XCircle,
  CalendarRange, Clock, MessageSquare,
} from 'lucide-react';
import { attendanceApi } from '../../../services/attendance';

const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-800'    },
  APPROVED:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-800'        },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500'    },
};

function daysBetween(start: string, end: string) {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

export function AdminAttendanceLeavePage() {
  const year = new Date().getFullYear();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [leave, setLeave]       = useState<any[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });
  const [filter, setFilter]     = useState<'PENDING' | 'ALL'>('PENDING');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [msg, setMsg]           = useState<string | null>(null);
  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ id: string; name: string; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [reviewNote, setReviewNote]   = useState('');

  const load = useCallback(async () => {
    const [h, l] = await Promise.all([
      attendanceApi.listHolidays(year),
      attendanceApi.listLeave(filter === 'PENDING' ? 'PENDING' : undefined),
    ]);
    setHolidays(h);
    setLeave(l);
  }, [filter, year]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const addHoliday = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.createHoliday(holidayForm);
      setHolidayForm({ date: '', name: '' });
      setMsg('Holiday added. Staff will be marked HOLIDAY for that date.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeHoliday = async (id: string, name: string) => {
    if (!confirm(`Remove holiday "${name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.deleteHoliday(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const openReview = (id: string, name: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewModal({ id, name, decision });
    setReviewNote('');
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;
    setBusy(true);
    setError(null);
    try {
      await attendanceApi.reviewLeave(reviewModal.id, {
        decision: reviewModal.decision,
        reviewNote: reviewNote.trim() || undefined,
      });
      setMsg(reviewModal.decision === 'APPROVED' ? 'Leave approved.' : 'Leave rejected.');
      setReviewModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const pending  = leave.filter((r) => r.status === 'PENDING').length;
  const approved = leave.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/admin/attendance" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Leave & holidays</h1>
      </div>

      {msg   && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{msg}</div>}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Leave stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending}</p>
          <p className="text-xs text-[var(--muted)]">Pending requests</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{approved}</p>
          <p className="text-xs text-[var(--muted)]">Approved this cycle</p>
        </div>
        <div className="card p-4 text-center sm:block hidden">
          <p className="text-2xl font-bold text-teal-600">{holidays.length}</p>
          <p className="text-xs text-[var(--muted)]">Holidays ({year})</p>
        </div>
      </div>

      {/* Holidays section */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Clinic holidays — {year}</h2>

        <form className="flex flex-wrap items-end gap-2" onSubmit={addHoliday}>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Date</span>
            <input
              type="date"
              required
              className="input mt-1 block"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <input
              required
              className="input mt-1 w-full"
              placeholder="e.g. Diwali"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add holiday'}
          </button>
        </form>

        {holidays.length > 0 ? (
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-3.5 w-3.5 text-teal-500" />
                  <span className="font-medium">{h.name}</span>
                  <span className="text-[var(--muted)]">{String(h.date).slice(0, 10)}</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => removeHoliday(h.id, h.name)}
                  aria-label="Delete holiday"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No holidays configured yet.</p>
        )}
      </section>

      {/* Leave requests section */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Leave requests</h2>
          <div className="flex gap-1.5">
            {(['PENDING', 'ALL'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === f ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'PENDING' ? `Pending${pending > 0 ? ` (${pending})` : ''}` : 'All'}
              </button>
            ))}
          </div>
        </div>

        {leave.length === 0 ? (
          <p className="py-4 text-sm text-[var(--muted)]">No leave requests.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {leave.map((r) => {
              const s = LEAVE_STATUS[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-500' };
              const days = daysBetween(String(r.startDate), String(r.endDate));
              return (
                <li key={r.id} className="space-y-2 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.user?.name || r.userId}</p>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-0.5">
                        <span className="flex items-center gap-1">
                          <CalendarRange className="h-3 w-3" />
                          {String(r.startDate).slice(0, 10)}{r.endDate !== r.startDate ? ` → ${String(r.endDate).slice(0, 10)}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{days} day{days !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {r.reason && <p className="mt-1 text-xs text-[var(--muted)]">{r.reason}</p>}
                      {r.reviewNote && (
                        <p className="mt-1 flex items-start gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                          {r.reviewNote}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
                        disabled={busy}
                        onClick={() => openReview(r.id, r.user?.name || 'user', 'APPROVED')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 text-red-600 hover:bg-red-50"
                        disabled={busy}
                        onClick={() => openReview(r.id, r.user?.name || 'user', 'REJECTED')}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="card w-full max-w-sm space-y-4 p-5"
            onSubmit={submitReview}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">
              {reviewModal.decision === 'APPROVED' ? '✓ Approve' : '✗ Reject'} leave request
            </h2>
            <p className="text-sm text-[var(--muted)]">For: <span className="font-medium text-[var(--text)]">{reviewModal.name}</span></p>
            <div>
              <label className="label">Review note (optional)</label>
              <textarea
                className="input min-h-[72px]"
                placeholder="Add a note for the employee…"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setReviewModal(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className={reviewModal.decision === 'APPROVED' ? 'btn-primary' : 'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition'}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewModal.decision === 'APPROVED' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
