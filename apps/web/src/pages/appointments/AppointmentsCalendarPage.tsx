import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { appointmentsApi } from '../../services/appointments';
import type { TherapySession } from '../../types/therapy';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthBounds(year: number, month: number) {
  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function doctorLabel(session: TherapySession) {
  if (!session.doctor) return 'Unassigned';
  return `Dr. ${session.doctor.name.replace(/^Dr\.?\s*/i, '')}`;
}

export function AppointmentsCalendarPage() {
  const today = new Date();
  const todayKey = dateKey(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const { start, end } = monthBounds(year, month);
    appointmentsApi.list({ startDate: start.toISOString(), endDate: end.toISOString(), page: 1, limit: 500 })
      .then((result) => setSessions(result.data || []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load calendar'))
      .finally(() => setLoading(false));
  }, [year, month]);

  const sessionsByDay = useMemo(() => {
    const result = new Map<string, TherapySession[]>();
    sessions.forEach((session) => {
      const key = dateKey(new Date(session.scheduledAt));
      result.set(key, [...(result.get(key) || []), session]);
    });
    result.forEach((rows) => rows.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    ));
    return result;
  }, [sessions]);

  const cells = useMemo(() => {
    const blanks = Array.from({ length: new Date(year, month, 1).getDay() }, () => null as number | null);
    const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1);
    return [...blanks, ...days];
  }, [year, month]);

  const selectedSessions = sessionsByDay.get(selectedDate) || [];
  const selectedLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Appointments calendar</h1>
          <p className="page-subtitle">Therapy visits only — select a date to review its sessions</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
        <section className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
            <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="text-center text-xs font-semibold text-gray-500 py-2">{weekday}</div>
              ))}
              {cells.map((day, index) => {
                if (day === null) return <div key={`blank-${index}`} className="min-h-[5rem] rounded-md bg-gray-50/50" />;
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const count = sessionsByDay.get(key)?.length || 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={`min-h-[5rem] rounded-md border p-2 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isToday
                          ? 'border-blue-200 bg-blue-50/30'
                          : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className={`text-sm font-medium ${isToday || isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{day}</span>
                    {count > 0 && <p className="mt-2 text-xs text-blue-600 font-medium">{count} visit{count === 1 ? '' : 's'}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="card p-4 xl:sticky xl:top-20">
          <div className="flex items-start justify-between gap-3 border-b pb-3 mb-3">
            <div>
              <p className="font-semibold text-gray-900">{selectedLabel}</p>
              <p className="text-sm text-gray-500">{selectedSessions.length} therapy visit{selectedSessions.length === 1 ? '' : 's'}</p>
            </div>
            <Link to={`/appointments/day?date=${selectedDate}`} className="btn-secondary text-xs whitespace-nowrap">
              Open day schedule
            </Link>
          </div>

          {selectedSessions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No therapy sessions on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/appointments/${session.id}`}
                  className="block rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{session.therapyCase?.patient?.name || 'Patient'}</p>
                      <p className="text-xs text-gray-500 font-mono">{session.therapyCase?.patient?.patientNumber}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-700 mt-2">
                    {new Date(session.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{doctorLabel(session)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">{session.therapyCase?.title || 'Therapy case'}</p>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
