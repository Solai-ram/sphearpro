import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { appointmentsApi, type DayBoard, type SlotTemplate } from '../../services/appointments';
import type { TherapySession } from '../../types/therapy';

const CARD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-950',
  'bg-emerald-50 border-emerald-200 text-emerald-950',
  'bg-amber-50 border-amber-200 text-amber-950',
  'bg-rose-50 border-rose-200 text-rose-950',
  'bg-cyan-50 border-cyan-200 text-cyan-950',
];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function moveDate(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return toDateKey(value);
}

function sessionTime(session: TherapySession) {
  const value = new Date(session.scheduledAt);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function fallbackSlots(): SlotTemplate[] {
  return Array.from({ length: 11 }, (_, index) => {
    const start = 9 * 60 + index * 45;
    const end = start + 45;
    const format = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return {
      id: `fallback-${index}`,
      label: `${format(start)}–${format(end)}`,
      startTime: format(start),
      endTime: format(end),
      sortOrder: index,
      isActive: true,
    };
  });
}

function colorFor(value: string) {
  const hash = [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
  return CARD_COLORS[hash % CARD_COLORS.length];
}

function SessionCard({
  session,
  duration,
  onOpen,
  compact = false,
}: {
  session: TherapySession;
  duration: number;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/session-id', session.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      title={[
        session.therapyCase?.patient?.name || 'Patient',
        `${sessionTime(session)} · ${duration}m`,
        session.therapyCase?.title || 'Therapy',
      ].join('\n')}
      className={`w-full h-full rounded-md border text-left cursor-grab active:cursor-grabbing overflow-hidden ${
        compact ? 'px-1.5 py-1' : 'p-2'
      } ${colorFor(session.therapyCaseId)}`}
    >
      <p className={`font-semibold truncate leading-tight ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {session.therapyCase?.patient?.name || 'Patient'}
      </p>
      <p className={`truncate leading-tight text-black/60 ${compact ? 'text-[10px] mt-0.5' : 'text-[11px] mt-0.5'}`}>
        {sessionTime(session)} · {duration}m
      </p>
      <p className={`truncate leading-tight text-black/55 ${compact ? 'text-[10px]' : 'text-[11px] mt-0.5'}`}>
        {session.therapyCase?.title || 'Therapy'}
      </p>
    </button>
  );
}

export function AppointmentDaySchedulerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || todayKey();
  const [board, setBoard] = useState<DayBoard | null>(null);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setBoard(await appointmentsApi.dayBoard(date));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load day schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const doctors = useMemo(
    () => board?.doctors.filter((doctor) => !doctorFilter || doctor.id === doctorFilter) || [],
    [board, doctorFilter],
  );

  const slots = useMemo(() => {
    if (!board) return [];
    const templates = board.slotTemplates.length ? [...board.slotTemplates] : fallbackSlots();
    const known = new Set(templates.map((slot) => slot.startTime));
    board.sessions.forEach((session) => {
      const startTime = sessionTime(session);
      if (!known.has(startTime)) {
        const end = minutes(startTime) + 45;
        templates.push({
          id: `session-${startTime}`,
          label: startTime,
          startTime,
          endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
          sortOrder: end,
          isActive: true,
        });
        known.add(startTime);
      }
    });
    return templates.sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  }, [board]);

  const sessions = board?.sessions || [];
  const unassigned = sessions.filter((session) => !session.doctorId);

  const sessionsForCell = (doctorId: string, startTime: string) => sessions.filter(
    (session) => session.doctorId === doctorId && sessionTime(session) === startTime,
  );

  const dropSession = async (event: DragEvent, doctorId: string, slot: SlotTemplate) => {
    event.preventDefault();
    const sessionId = event.dataTransfer.getData('text/session-id');
    const session = sessions.find((row) => row.id === sessionId);
    if (!session) return;

    setSavingId(sessionId);
    setError(null);
    try {
      const availability = await appointmentsApi.availability(doctorId, date, sessionId);
      const isAvailable = availability.slots.some((row) => row.startTime === slot.startTime);
      const occupant = sessionsForCell(doctorId, slot.startTime).find((row) => row.id !== sessionId);
      if (occupant) {
        setError('This doctor already has a patient in that slot. Pick another time.');
        return;
      }
      if (!isAvailable) {
        setError('Doctor not available for this slot');
        return;
      }
      const scheduledAt = new Date(`${date}T${slot.startTime}:00`).toISOString();
      const updated = await appointmentsApi.assignDoctor(sessionId, doctorId, scheduledAt);
      setBoard((current) => current
        ? { ...current, sessions: current.sessions.map((row) => (row.id === updated.id ? updated : row)) }
        : current);
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : 'Failed to move appointment');
    } finally {
      setSavingId(null);
    }
  };

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Day schedule</h1>
          <p className="page-subtitle">Same patient can appear under several doctors on one day — drag to reassign by availability</p>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => setSearchParams({ date: todayKey() })}>Today</button>
        <button type="button" className="btn-secondary" onClick={() => setSearchParams({ date: moveDate(date, -1) })} aria-label="Previous day">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" className="btn-secondary" onClick={() => setSearchParams({ date: moveDate(date, 1) })} aria-label="Next day">
          <ChevronRight className="w-4 h-4" />
        </button>
        <input type="date" className="input w-auto" value={date} onChange={(event) => setSearchParams({ date: event.target.value })} />
        <span className="text-sm font-medium text-gray-800">{dateLabel}</span>
        <select className="input w-full sm:w-56 sm:ml-auto" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
          <option value="">All doctors</option>
          {board?.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : !board ? (
        <div className="card p-8 text-center text-gray-500">Schedule could not be loaded.</div>
      ) : (
        <>
          <section className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Unassigned</h2>
              <span className="badge-gray">{unassigned.length}</span>
              {savingId && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>
            {unassigned.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">All sessions have a doctor.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {unassigned.map((session) => {
                  const slot = slots.find((row) => row.startTime === sessionTime(session));
                  return (
                    <div key={session.id} className="w-44 shrink-0">
                      <SessionCard
                        session={session}
                        duration={slot ? minutes(slot.endTime) - minutes(slot.startTime) : 45}
                        onOpen={() => navigate(`/appointments/${session.id}`)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-18rem)]">
              <div
                className="grid"
                style={{
                  // ≤7 doctors: fill the card width. >7: widen so ~7 fit, then horizontal scroll.
                  width: doctors.length > 7 ? `${(doctors.length / 7) * 100}%` : '100%',
                  gridTemplateColumns: `4.5rem repeat(${Math.max(doctors.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                <div className="sticky top-0 left-0 z-20 bg-gray-50 border-b border-r px-2 py-2 text-[11px] font-semibold text-gray-500">
                  Time
                </div>
                {doctors.map((doctor) => (
                  <div key={doctor.id} className="sticky top-0 z-10 bg-gray-50 border-b border-r px-2 py-2 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
                      Dr. {doctor.name.replace(/^Dr\.?\s*/i, '')}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">
                      {doctor.specialization || 'Doctor'}
                    </p>
                  </div>
                ))}

                {slots.flatMap((slot) => [
                  <div
                    key={`time-${slot.id}`}
                    className="sticky left-0 z-[5] bg-white border-b border-r px-2 py-1.5 h-[4.25rem] text-[11px] font-medium text-gray-600"
                  >
                    {slot.startTime}
                    <p className="text-[10px] text-gray-400 leading-tight">{slot.endTime}</p>
                  </div>,
                  ...doctors.map((doctor) => {
                    const cellSessions = sessionsForCell(doctor.id, slot.startTime);
                    // One doctor can only have one visit per slot — show first, flag extras
                    const primary = cellSessions[0];
                    const clashCount = cellSessions.length;
                    return (
                      <div
                        key={`${slot.id}-${doctor.id}`}
                        className="h-[4.25rem] min-w-0 border-b border-r p-1 bg-white hover:bg-blue-50/30"
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => dropSession(event, doctor.id, slot)}
                      >
                        {primary && (
                          <div className="h-full min-h-0 relative">
                            <SessionCard
                              session={primary}
                              duration={minutes(slot.endTime) - minutes(slot.startTime)}
                              compact
                              onOpen={() => navigate(`/appointments/${primary.id}`)}
                            />
                            {clashCount > 1 && (
                              <span
                                className="absolute -top-0.5 -right-0.5 badge-danger text-[9px] px-1"
                                title={`${clashCount} overlapping bookings — reassign one`}
                              >
                                +{clashCount - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }),
                ])}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
