import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarPlus, Loader2 } from 'lucide-react';
import { appointmentsApi, type AvailableSlot } from '../../services/appointments';
import type { TherapySession } from '../../types/therapy';

type Doctor = { id: string; name: string; staffType?: string };

function ymd(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function doctorLabel(doctor: { name: string }) {
  return `Dr. ${doctor.name.replace(/^Dr\.?\s*/i, '')}`;
}

function SessionAssignment({
  session,
  indexOnDay,
  doctors,
  saving,
  onAssigned,
  onError,
}: {
  session: TherapySession;
  indexOnDay: number;
  doctors: Doctor[];
  saving: boolean;
  onAssigned: (session: TherapySession) => void;
  onError: (message: string) => void;
}) {
  const [doctorId, setDoctorId] = useState(session.doctorId || '');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    setDoctorId(session.doctorId || '');
  }, [session.doctorId]);

  useEffect(() => {
    if (!doctorId) {
      setSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    appointmentsApi.availability(doctorId, ymd(session.scheduledAt), session.id)
      .then((result) => {
        if (active) setSlots(result.slots);
      })
      .catch((error) => {
        if (active) onError(error instanceof Error ? error.message : 'Failed to load available slots');
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [doctorId, session.id, session.scheduledAt]);

  const assign = async (slot: AvailableSlot) => {
    try {
      const updated = await appointmentsApi.assignDoctor(
        session.id,
        doctorId,
        new Date(slot.scheduledAt).toISOString(),
      );
      onAssigned(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to assign doctor');
    }
  };

  const currentStart = `${String(new Date(session.scheduledAt).getHours()).padStart(2, '0')}:${String(new Date(session.scheduledAt).getMinutes()).padStart(2, '0')}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Session {indexOnDay} · {formatTime(session.scheduledAt)}
          </p>
          <Link to={`/therapy/${session.therapyCaseId}`} className="text-sm text-gray-700 hover:text-blue-600 hover:underline">
            {session.therapyCase?.title || 'Therapy case'}
          </Link>
          {session.doctor && (
            <p className="text-xs text-gray-500 mt-0.5">Assigned: {doctorLabel(session.doctor)}</p>
          )}
        </div>
        <select
          className="input w-full sm:w-56"
          value={doctorId}
          disabled={saving}
          onChange={(event) => setDoctorId(event.target.value)}
        >
          <option value="">Select doctor</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctorLabel(doctor)}</option>
          ))}
        </select>
      </div>

      {doctorId && (
        <div>
          <p className="label">Available slots for this doctor</p>
          {loadingSlots ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : slots.length ? (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const selected = slot.startTime === currentStart && session.doctorId === doctorId;
                return (
                  <button
                    key={slot.templateId}
                    type="button"
                    className={`${selected ? 'badge-success ring-2 ring-emerald-300' : 'badge-info'} cursor-pointer hover:ring-2 hover:ring-blue-200`}
                    disabled={saving}
                    onClick={() => assign(slot)}
                  >
                    {slot.label || `${slot.startTime}–${slot.endTime}`}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No available slots for this doctor on this day.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AssignDoctorPage() {
  const { patientId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusDate = searchParams.get('date') || '';
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(focusDate || ymd(new Date()));
  const [addTime, setAddTime] = useState('09:00');
  const [addDoctorId, setAddDoctorId] = useState('');
  const [addSlots, setAddSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      appointmentsApi.list({
        status: 'SCHEDULED',
        startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        page: 1,
        limit: 300,
      }),
      appointmentsApi.getDoctors(),
    ])
      .then(([result, doctorRows]) => {
        if (!active) return;
        setSessions((result.data || []).filter((session) => session.therapyCase?.patient?.id === patientId));
        setDoctors([...doctorRows].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load sessions');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [patientId]);

  const patient = sessions[0]?.therapyCase?.patient;
  const patientName = patient?.name || 'Patient';
  const patientNumber = patient?.patientNumber || '';

  const caseOptions = useMemo(() => (
    [...new Map(sessions.map((session) => [
      session.therapyCaseId,
      session.therapyCase?.title || 'Therapy case',
    ])).entries()]
  ), [sessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, TherapySession[]>();
    const sorted = [...sessions]
      .filter((session) => !focusDate || ymd(session.scheduledAt) === focusDate)
      .sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    for (const session of sorted) {
      const key = ymd(session.scheduledAt);
      map.set(key, [...(map.get(key) || []), session]);
    }
    return [...map.entries()];
  }, [sessions, focusDate]);

  useEffect(() => {
    if (!caseOptions.some(([id]) => id === selectedCaseId)) {
      setSelectedCaseId(caseOptions[0]?.[0] || '');
    }
  }, [caseOptions, selectedCaseId]);

  useEffect(() => {
    if (!addDoctorId || !addDate) {
      setAddSlots([]);
      return;
    }
    appointmentsApi.availability(addDoctorId, addDate)
      .then((result) => setAddSlots(result.slots))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load available slots'));
  }, [addDoctorId, addDate]);

  const updateSession = (updated: TherapySession) => {
    setSessions((current) => current.map((session) => (session.id === updated.id ? updated : session)));
  };

  const openAddSlot = (preferDate?: string) => {
    const date = preferDate || (sessions[0] ? ymd(sessions[0].scheduledAt) : ymd(new Date()));
    setAddDate(date);
    const sameDay = sessions.filter((s) => ymd(s.scheduledAt) === date);
    if (sameDay.length) {
      const last = sameDay[sameDay.length - 1];
      const d = new Date(last.scheduledAt);
      d.setMinutes(d.getMinutes() + 45);
      setAddTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setAddTime('09:00');
    }
    setAddDoctorId('');
    setShowAdd(true);
  };

  const addSession = async () => {
    if (!selectedCaseId || !addDate || !addTime) return;

    const clash = sessions.some((session) => {
      const start = new Date(session.scheduledAt);
      return ymd(start) === addDate
        && `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` === addTime;
    });
    if (clash) {
      setError('This patient already has a session at that time. Pick another slot on the same day.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await appointmentsApi.addSlot(selectedCaseId, {
        scheduledAt: new Date(`${addDate}T${addTime}:00`).toISOString(),
        doctorId: addDoctorId || undefined,
      });
      setSessions((current) => [...current, created].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ));
      setShowAdd(false);
      setAddDoctorId('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600"
            onClick={() => navigate('/appointments')}
          >
            <ArrowLeft className="w-4 h-4" /> Back to patients
          </button>
          <h1 className="page-title">{loading ? 'Assign doctors' : patientName}</h1>
          <p className="page-subtitle">
            {patientNumber
              ? `${patientNumber} · assign a doctor and slot for each therapy visit`
              : 'Assign a doctor and slot for each therapy visit'}
            {focusDate
              ? ` · showing ${new Date(`${focusDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
              : ''}
          </p>
        </div>
        {!loading && sessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {focusDate && (
              <button type="button" className="btn-secondary" onClick={() => setSearchParams({})}>
                Show all days
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => openAddSlot(focusDate || ymd(new Date()))}>
              Add slot today
            </button>
            <button type="button" className="btn-primary" onClick={() => openAddSlot(focusDate || undefined)}>
              <CalendarPlus className="w-4 h-4 mr-2" /> Add slot
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <p className="font-medium text-gray-700">No upcoming sessions for this patient</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => navigate('/appointments')}>
            Back to list
          </button>
        </div>
      ) : (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {caseOptions.map(([id, title]) => (
              <Link key={id} to={`/therapy/${id}`} className="text-sm text-blue-600 hover:underline">{title}</Link>
            ))}
          </div>

          {showAdd && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Add another session slot</h3>
              <p className="text-xs text-gray-600">
                Use the same date for another doctor visit on that day. Times must not overlap for this patient.
              </p>
              {caseOptions.length > 1 && (
                <select className="input" value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}>
                  {caseOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                </select>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input type="date" className="input" value={addDate} onChange={(event) => setAddDate(event.target.value)} />
                <select className="input" value={addDoctorId} onChange={(event) => setAddDoctorId(event.target.value)}>
                  <option value="">Doctor (optional now)</option>
                  {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorLabel(doctor)}</option>)}
                </select>
                <input type="time" className="input" value={addTime} onChange={(event) => setAddTime(event.target.value)} step={2700} />
              </div>
              {addDoctorId && addSlots.length > 0 && (
                <div>
                  <p className="label">Available slots for selected doctor</p>
                  <div className="flex flex-wrap gap-2">
                    {addSlots.map((slot) => (
                      <button
                        key={slot.templateId}
                        type="button"
                        className={addTime === slot.startTime ? 'badge-success cursor-pointer' : 'badge-info cursor-pointer'}
                        onClick={() => setAddTime(slot.startTime)}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={saving} onClick={addSession}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save slot
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {sessionsByDay.map(([day, daySessions]) => (
              <div key={day} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {formatDate(`${day}T12:00:00`)}
                    <span className="ml-2 font-normal text-gray-500">
                      {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
                      {daySessions.length > 1 ? ' · multiple doctors OK' : ''}
                    </span>
                  </h3>
                  <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => openAddSlot(day)}>
                    + Another session this day
                  </button>
                </div>
                <div className="space-y-2">
                  {daySessions.map((session, index) => (
                    <SessionAssignment
                      key={session.id}
                      session={session}
                      indexOnDay={index + 1}
                      doctors={doctors}
                      saving={saving}
                      onAssigned={updateSession}
                      onError={setError}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
