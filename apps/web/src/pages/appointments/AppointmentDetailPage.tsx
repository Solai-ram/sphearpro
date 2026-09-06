import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Stethoscope } from 'lucide-react';
import { appointmentsApi } from '../../services/appointments';
import type { AttendanceStatus, TherapySession } from '../../types/therapy';

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'badge-info',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  RESCHEDULED: 'badge-warning',
  NO_SHOW: 'badge-gray',
};

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'CANCELLED'];

function staffLabel(p: { name: string }) {
  return `Dr. ${p.name.replace(/^Dr\.?\s*/i, '')}`;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<TherapySession | null>(null);
  const [doctors, setDoctors] = useState<{ id: string; name: string; staffType?: string }[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notePrompt, setNotePrompt] = useState<{ caseId: string; sessionId: string } | null>(null);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getById(id);
      setSession(data);
      setScheduledAt(toLocalDatetimeValue(data.scheduledAt));
      setDoctorId(data.doctorId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    appointmentsApi.getDoctors().then((list) => {
      setDoctors([...list].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [id]);

  const assignDoctor = async () => {
    if (!id || !doctorId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await appointmentsApi.assignDoctor(id, doctorId);
      setSession(updated);
      setDoctorId(updated.doctorId || '');
      setMessage('Doctor assigned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign doctor');
    } finally {
      setSaving(false);
    }
  };

  const reschedule = async () => {
    if (!id || !scheduledAt) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await appointmentsApi.reschedule(id, new Date(scheduledAt).toISOString());
      setSession(updated);
      setScheduledAt(toLocalDatetimeValue(updated.scheduledAt));
      setMessage('Appointment rescheduled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  const markAttendance = async (status: AttendanceStatus) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setNotePrompt(null);
    try {
      const updated = await appointmentsApi.markAttendance(id, status);
      setSession(updated);
      setMessage(`Attendance marked: ${status}`);
      if (updated.noteRequired) {
        setNotePrompt({
          caseId: updated.therapyCaseId,
          sessionId: updated.id,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  if (!session) {
    return (
      <div className="space-y-3">
        <Link to="/appointments" className="text-sm text-blue-600 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to appointments
        </Link>
        <div className="card p-8 text-center text-gray-500">{error || 'Appointment not found'}</div>
      </div>
    );
  }

  const when = new Date(session.scheduledAt);
  const hasAttendance = Boolean(session.attendance);

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/appointments" className="text-sm text-blue-600 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to appointments
        </Link>
        <Link to={`/therapy/${session.therapyCaseId}`} className="btn-secondary text-sm">
          Open therapy case
        </Link>
      </div>

      <div>
        <h1 className="page-title">Appointment</h1>
        <p className="page-subtitle">Therapy visit — one doctor per session</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{message}</div>
      )}
      {notePrompt && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Doctor session note required</p>
          <p className="text-xs text-amber-800">
            This visit is complete. Add the attending doctor’s SOAP note on the therapy case Notes tab.
          </p>
          <Link
            to={`/therapy/${notePrompt.caseId}?tab=notes&sessionId=${notePrompt.sessionId}`}
            className="inline-flex btn-primary text-sm"
          >
            Add session note
          </Link>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Patient</p>
            <p className="font-medium text-gray-900">{session.therapyCase?.patient?.name || '—'}</p>
            <p className="text-xs text-gray-500 font-mono">{session.therapyCase?.patient?.patientNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Therapy case</p>
            <Link to={`/therapy/${session.therapyCaseId}`} className="font-medium text-blue-600 hover:underline">
              {session.therapyCase?.title || 'Case'}
            </Link>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</p>
            <p className="font-medium">
              {when.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
            <span className={STATUS_BADGE[session.status] || 'badge-gray'}>{session.status.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5" /> Doctor
            </p>
            <p className="font-medium">{session.doctor ? staffLabel(session.doctor) : 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Attendance</p>
            <p className="font-medium">
              {session.attendance
                ? session.attendance.status.replace(/_/g, ' ')
                : 'Not marked'}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Assign doctor</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1 min-w-[12rem]"
            value={doctorId}
            disabled={saving}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{staffLabel(d)}</option>
            ))}
          </select>
          <button type="button" className="btn-primary" disabled={saving || !doctorId} onClick={assignDoctor}>
            Save doctor
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Reschedule</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="datetime-local"
            className="input flex-1 min-w-[12rem]"
            value={scheduledAt}
            disabled={saving}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <button type="button" className="btn-primary" disabled={saving || !scheduledAt} onClick={reschedule}>
            Save time
          </button>
        </div>
      </div>

      {!hasAttendance && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Mark attendance</h2>
          <div className="flex flex-wrap gap-2">
            {ATTENDANCE_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => markAttendance(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {saving && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving…
        </div>
      )}
    </div>
  );
}
