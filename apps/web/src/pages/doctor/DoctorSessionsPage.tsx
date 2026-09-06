import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, Loader2, Stethoscope, User } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import type { TherapySession } from '../../types/therapy';
import { useAuth } from '../../auth/AuthContext';

function formatWhen(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function DoctorSessionsPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!hasRole('DOCTOR', 'ADMIN')) return;
    let cancelled = false;
    setLoading(true);
    therapyApi
      .listMyDoctorSessions()
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sessions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.staffProfileId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const name = s.therapyCase?.patient?.name?.toLowerCase() || '';
      const number = s.therapyCase?.patient?.patientNumber?.toLowerCase() || '';
      const title = s.therapyCase?.title?.toLowerCase() || '';
      return name.includes(q) || number.includes(q) || title.includes(q);
    });
  }, [sessions, search]);

  if (!hasRole('DOCTOR', 'ADMIN')) {
    return (
      <div className="card p-8 text-center text-gray-500">
        This screen is for doctors only.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="page-title">My appointment patients</h1>
        <p className="page-subtitle">
          Only patients assigned to you. Select one to record the session.
        </p>
      </div>

      {!user?.staffProfileId && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Your login is not linked to a staff profile. Ask admin to link your user to a doctor staff record.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <input
        className="input"
        placeholder="Search patient name or ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <Stethoscope className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        No upcoming appointments assigned to you.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((session) => {
            const when = formatWhen(session.scheduledAt);
            const patient = session.therapyCase?.patient;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  className="card w-full text-left p-4 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  onClick={() => navigate(`/doctor/sessions/${session.id}`)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{patient?.name || 'Patient'}</p>
                        <p className="text-xs text-gray-500 font-mono">{patient?.patientNumber}</p>
                        <p className="text-sm text-gray-600 mt-1">{session.therapyCase?.title}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {when.date}
                      </p>
                      <p className="font-medium text-gray-900">{when.time}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        Only sessions assigned to you appear here (today and overdue up to 14 days). Reception assigns doctors on the appointments board.
      </p>
    </div>
  );
}
