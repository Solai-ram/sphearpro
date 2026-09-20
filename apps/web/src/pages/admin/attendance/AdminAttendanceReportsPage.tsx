import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { attendanceApi } from '../../../services/attendance';

function AttendanceBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color =
    pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-[10px] font-medium" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function AdminAttendanceReportsPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    attendanceApi
      .monthlyReport(year, month)
      .then((res) => setData(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [year, month]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await attendanceApi.downloadMonthlyCsv(year, month);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totals = useMemo(() => {
    return data.reduce(
      (acc, r) => ({
        present:  acc.present  + (r.present  || 0),
        late:     acc.late     + (r.late     || 0),
        absent:   acc.absent   + (r.absent   || 0),
        leave:    acc.leave    + (r.leave    || 0),
        lateMinutes: acc.lateMinutes + (r.lateMinutes || 0),
      }),
      { present: 0, late: 0, absent: 0, leave: 0, lateMinutes: 0 },
    );
  }, [data]);

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/admin/attendance" className="btn-ghost p-2">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Monthly attendance report</h1>
            <p className="text-sm text-[var(--muted)]">{monthLabel}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-1.5 text-sm"
          disabled={exporting || loading}
          onClick={exportCsv}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost p-2" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 text-center text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          className="btn-ghost p-2"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary chips */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total present', value: totals.present, cls: 'text-emerald-600' },
            { label: 'Total late',    value: totals.late,    cls: 'text-amber-600'   },
            { label: 'Total absent',  value: totals.absent,  cls: 'text-red-600'     },
            { label: 'Total leave',   value: totals.leave,   cls: 'text-sky-600'     },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-3 text-center">
              <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              <p className="text-[11px] text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}

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
                <th className="px-4 py-2.5 text-center">Present</th>
                <th className="px-4 py-2.5 text-center">Late</th>
                <th className="px-4 py-2.5 text-center">Absent</th>
                <th className="px-4 py-2.5 text-center">Leave</th>
                <th className="px-4 py-2.5">Attendance</th>
                <th className="px-4 py-2.5">Hours</th>
                <th className="px-4 py-2.5 text-center">Late mins</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => {
                const workingDays = (r.present || 0) + (r.late || 0) + (r.absent || 0);
                return (
                  <tr key={r.user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.user.name}</p>
                      <p className="text-xs text-[var(--muted)]">{r.user.staffType || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">{r.present}</td>
                    <td className="px-4 py-3 text-center font-medium text-amber-600">{r.late}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-600">{r.absent}</td>
                    <td className="px-4 py-3 text-center font-medium text-sky-600">{r.leave}</td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <AttendanceBar value={(r.present || 0) + (r.late || 0)} total={workingDays || 1} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{r.workingHoursDisplay || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.lateMinutes > 0 ? (
                        <span className="text-amber-600 font-medium">{r.lateMinutes}</span>
                      ) : (
                        <span className="text-[var(--muted)]">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              {data.length > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-xs uppercase text-[var(--muted)]">Totals</td>
                  <td className="px-4 py-2.5 text-center text-emerald-600">{totals.present}</td>
                  <td className="px-4 py-2.5 text-center text-amber-600">{totals.late}</td>
                  <td className="px-4 py-2.5 text-center text-red-600">{totals.absent}</td>
                  <td className="px-4 py-2.5 text-center text-sky-600">{totals.leave}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-center text-amber-600">
                    {totals.lateMinutes > 0 ? totals.lateMinutes : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!data.length && (
            <p className="py-10 text-center text-sm text-[var(--muted)]">No attendance data for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}
