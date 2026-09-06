import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Search, UserRound } from 'lucide-react';
import { appointmentsApi } from '../../services/appointments';
import type { TherapySession } from '../../types/therapy';
import { useAuth } from '../../auth/AuthContext';

type PatientGroup = {
  patientId: string;
  name: string;
  patientNumber: string;
  sessions: TherapySession[];
};

type DateFilter = 'today' | 'tomorrow' | 'custom';

function ymd(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function dayBounds(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(`${dateKey}T23:59:59.999`);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function formatFilterLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function AppointmentsListPage() {
  const { user } = useAuth();
  const isDoctorOnly = user?.staffType === 'DOCTOR' && !(user.roles || []).includes('ADMIN');

  const todayKey = ymd(new Date());
  const tomorrowKey = ymd(addDays(new Date(), 1));

  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterDate = dateFilter === 'today'
    ? todayKey
    : dateFilter === 'tomorrow'
      ? tomorrowKey
      : customDate;

  useEffect(() => {
    if (isDoctorOnly) return;
    let active = true;
    setLoading(true);
    setError(null);
    const { startDate, endDate } = dayBounds(filterDate);
    appointmentsApi.list({
      status: 'SCHEDULED',
      startDate,
      endDate,
      page: 1,
      limit: 300,
    })
      .then((result) => {
        if (active) setSessions(result.data || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load upcoming therapy sessions');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filterDate, isDoctorOnly]);

  const groups = useMemo(() => {
    const onDay = sessions.filter((session) => ymd(session.scheduledAt) === filterDate);
    const grouped = new Map<string, PatientGroup>();
    onDay.forEach((session) => {
      const patient = session.therapyCase?.patient;
      if (!patient) return;
      const current = grouped.get(patient.id) || {
        patientId: patient.id,
        name: patient.name,
        patientNumber: patient.patientNumber,
        sessions: [],
      };
      current.sessions.push(session);
      grouped.set(patient.id, current);
    });
    return [...grouped.values()]
      .filter((group) => `${group.name} ${group.patientNumber} ${group.sessions.map((s) => s.therapyCase?.title).join(' ')}`
        .toLowerCase().includes(search.toLowerCase()))
      .map((group) => ({
        ...group,
        sessions: [...group.sessions].sort(
          (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
        ),
      }))
      .sort((a, b) => new Date(a.sessions[0].scheduledAt).getTime() - new Date(b.sessions[0].scheduledAt).getTime());
  }, [sessions, search, filterDate]);

  if (isDoctorOnly) {
    return <Navigate to="/doctor/sessions" replace />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Assign Doctors</h1>
        <p className="page-subtitle">
          Therapy patients for {formatFilterLabel(filterDate)} — open a patient to assign doctors and slots.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented">
          <button
            type="button"
            className={dateFilter === 'today' ? 'is-on' : ''}
            onClick={() => setDateFilter('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={dateFilter === 'tomorrow' ? 'is-on' : ''}
            onClick={() => setDateFilter('tomorrow')}
          >
            Tomorrow
          </button>
          <button
            type="button"
            className={dateFilter === 'custom' ? 'is-on' : ''}
            onClick={() => setDateFilter('custom')}
          >
            Select date
          </button>
        </div>
        {dateFilter === 'custom' && (
          <input
            type="date"
            className="input w-auto"
            value={customDate}
            min={todayKey}
            onChange={(event) => setCustomDate(event.target.value || todayKey)}
          />
        )}
        <div className="relative min-w-[14rem] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient or therapy"
          />
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          No therapy patients scheduled for {formatFilterLabel(filterDate)}.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const therapyTitles = [...new Set(group.sessions.map((session) => session.therapyCase?.title).filter(Boolean))];
            return (
              <div
                key={group.patientId}
                className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{group.patientNumber}</p>
                  <p className="text-sm text-gray-600 mt-1 truncate">{therapyTitles.join(', ')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {group.sessions.length} session{group.sessions.length === 1 ? '' : 's'} on {formatFilterLabel(filterDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge-info">{group.sessions.length}</span>
                  <Link
                    to={`/appointments/assign/${group.patientId}?date=${filterDate}`}
                    className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <UserRound className="w-4 h-4" />
                    Assign Doctor
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
