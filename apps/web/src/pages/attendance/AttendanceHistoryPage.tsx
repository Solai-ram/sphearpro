import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { attendanceApi } from '../../services/attendance';

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  PRESENT:  { label: 'Present',  dot: 'bg-emerald-500', text: 'text-emerald-700' },
  LATE:     { label: 'Late',     dot: 'bg-amber-500',   text: 'text-amber-700'   },
  ABSENT:   { label: 'Absent',   dot: 'bg-red-500',     text: 'text-red-700'     },
  ON_LEAVE: { label: 'Leave',    dot: 'bg-sky-500',     text: 'text-sky-700'     },
  HALF_DAY: { label: 'Half day', dot: 'bg-violet-500',  text: 'text-violet-700'  },
  HOLIDAY:  { label: 'Holiday',  dot: 'bg-teal-500',    text: 'text-teal-700'    },
  WEEK_OFF: { label: 'Week off', dot: 'bg-slate-300',   text: 'text-slate-500'   },
};

function StatusDot({ status }: { status?: string }) {
  if (!status) return <span className="h-2 w-2 rounded-full bg-slate-200" />;
  const s = STATUS_META[status] ?? { dot: 'bg-slate-300' };
  return <span className={`h-2 w-2 rounded-full ${s.dot}`} />;
}

export function AttendanceHistoryPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    attendanceApi
      .history(year, month)
      .then((res) => setRows(res.data || []))
      .finally(() => setLoading(false));
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of rows) {
      const day = Number(String(r.date).slice(8, 10)) || new Date(r.date).getUTCDate();
      map.set(day, r);
    }
    return map;
  }, [rows]);

  // Monthly summary stats
  const stats = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, leave: 0, halfDay: 0 };
    let totalMinutes = 0;
    for (const r of rows) {
      if (r.status === 'PRESENT') counts.present++;
      else if (r.status === 'LATE') { counts.present++; counts.late++; }
      else if (r.status === 'ABSENT') counts.absent++;
      else if (r.status === 'ON_LEAVE') counts.leave++;
      else if (r.status === 'HALF_DAY') counts.halfDay++;
      if (typeof r.workingMinutes === 'number') totalMinutes += r.workingMinutes;
    }
    const totalHrs = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;
    return { ...counts, totalHoursDisplay: totalMinutes ? `${totalHrs}h ${totalMins}m` : null };
  }, [rows]);

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth  = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/attendance" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Attendance history</h1>
      </div>

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
          disabled={year === now.getFullYear() && month >= now.getMonth() + 1}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Monthly summary stats */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Present', value: stats.present, cls: 'text-emerald-600' },
            { label: 'Late',    value: stats.late,    cls: 'text-amber-600'   },
            { label: 'Absent',  value: stats.absent,  cls: 'text-red-600'     },
            { label: 'Leave',   value: stats.leave,   cls: 'text-sky-600'     },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-3 text-center">
              <p className={`text-xl font-bold ${cls}`}>{value}</p>
              <p className="text-[11px] text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}
      {!loading && stats.totalHoursDisplay && (
        <p className="text-right text-xs text-[var(--muted)]">
          Total working hours: <span className="font-semibold text-[var(--text)]">{stats.totalHoursDisplay}</span>
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="card p-3">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} />;
                const rec = byDay.get(day);
                const isSel = selected && Number(String(selected.date).slice(8, 10)) === day;
                const isToday =
                  year === now.getFullYear() &&
                  month === now.getMonth() + 1 &&
                  day === now.getDate();
                return (
                  <button
                    key={day}
                    type="button"
                    className={`relative flex flex-col items-center justify-center aspect-square rounded-lg text-sm transition
                      ${isSel ? 'ring-2 ring-[var(--primary)]' : ''}
                      ${isToday ? 'font-bold' : ''}
                      ${rec ? 'bg-slate-50 hover:bg-slate-100 cursor-pointer' : 'text-slate-400 cursor-default'}
                    `}
                    onClick={() => setSelected(rec || null)}
                    disabled={!rec}
                  >
                    {day}
                    {rec && <StatusDot status={rec.status} />}
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--muted)]">
              {[
                ['Present', 'PRESENT'],
                ['Late',    'LATE'],
                ['Absent',  'ABSENT'],
                ['Leave',   'ON_LEAVE'],
                ['Holiday', 'HOLIDAY'],
              ].map(([label, st]) => (
                <span key={st} className="inline-flex items-center gap-1.5">
                  <StatusDot status={st} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Day detail */}
          {selected && (
            <div className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">
                {new Date(selected.date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">
                  {formatTime(selected.checkIn)} – {formatTime(selected.checkOut)}
                </span>
                {(() => {
                  const s = STATUS_META[selected.status];
                  return s ? (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
                      <StatusDot status={selected.status} />
                      {s.label}
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span>{selected.workingHoursDisplay || '—'}</span>
                {selected.lateMinutes > 0 && (
                  <span className="text-amber-600 text-xs">{selected.lateMinutes}m late</span>
                )}
              </div>
              {selected.remarks && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Note: {selected.remarks}
                </p>
              )}
            </div>
          )}

          {/* List */}
          <div className="card divide-y p-0">
            {rows.map((r) => {
              const s = STATUS_META[r.status];
              return (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => setSelected(r)}
                >
                  <div>
                    <p className="font-medium">
                      {new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[var(--muted)]">
                      {formatTime(r.checkIn)} – {formatTime(r.checkOut)}
                    </p>
                  </div>
                  <div className="text-right">
                    {s ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
                        <StatusDot status={r.status} />
                        {s.label}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">{r.status}</span>
                    )}
                    <p className="text-xs text-[var(--muted)]">{r.workingHoursDisplay}</p>
                  </div>
                </button>
              );
            })}
            {!rows.length && (
              <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">No records this month.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
