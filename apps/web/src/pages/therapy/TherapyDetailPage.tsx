import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Plus, Mic, Square } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import type { TherapyCase, TherapyPackage, AttendanceStatus, TherapyNote } from '../../types/therapy';
import { useAuth } from '../../auth/AuthContext';

type Tab = 'sessions' | 'packages' | 'notes' | 'progress' | 'ai';

const SESSION_BADGE: Record<string, string> = {
  SCHEDULED: 'badge-info',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  RESCHEDULED: 'badge-warning',
  NO_SHOW: 'badge-gray',
};

const SOAP_FIELDS: Array<{ key: keyof TherapyNote; label: string }> = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'activities', label: 'Activities' },
  { key: 'observations', label: 'Observations' },
  { key: 'progress', label: 'Progress' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'nextPlan', label: 'Next plan' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function doctorLabel(name?: string) {
  if (!name) return 'Doctor';
  return `Dr. ${name.replace(/^Dr\.?\s*/i, '')}`;
}

function authorRole(staffType?: string) {
  if (staffType === 'DOCTOR') return 'Doctor';
  return staffType || 'Staff';
}

export function TherapyDetailPage() {
  const { user } = useAuth();
  const isDoctorOnly = user?.staffType === 'DOCTOR' && !(user.roles || []).includes('ADMIN');
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [therapyCase, setTherapyCase] = useState<TherapyCase | null>(null);
  const [packages, setPackages] = useState<TherapyPackage[]>([]);
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'sessions');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [packageId, setPackageId] = useState('');
  const [noteSessionId, setNoteSessionId] = useState(searchParams.get('sessionId') || '');
  const [note, setNote] = useState<Partial<TherapyNote>>({});
  const [metric, setMetric] = useState({ metric: '', value: '', note: '' });
  const [reschedule, setReschedule] = useState({ sessionId: '', scheduledAt: '' });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reload = async () => {
    if (!id) return;
    const data = await therapyApi.getCase(id);
    setTherapyCase(data);
    return data;
  };

  useEffect(() => {
    if (isDoctorOnly) return;
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [data, catalog] = await Promise.all([therapyApi.getCase(id), therapyApi.getPackages()]);
        setTherapyCase(data);
        setPackages(catalog.data);
        const pendingId = searchParams.get('sessionId')
          || data.pendingDoctorNotes?.[0]?.sessionId
          || '';
        if (pendingId) setNoteSessionId(pendingId);
        if (searchParams.get('tab') === 'notes') setTab('notes');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, isDoctorOnly]);

  const selectTab = (next: Tab, sessionId?: string) => {
    const nextSessionId = sessionId ?? noteSessionId;
    setTab(next);
    if (sessionId) setNoteSessionId(sessionId);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (nextSessionId) params.set('sessionId', nextSessionId);
    else params.delete('sessionId');
    setSearchParams(params, { replace: true });
  };

  const handleAssign = async () => {
    if (!id || !packageId) return;
    try {
      await therapyApi.assignPackage(id, { packageId });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign package');
    }
  };

  const handleAttendance = async (sessionId: string, status: AttendanceStatus) => {
    try {
      setError(null);
      setMessage(null);
      const updated = await therapyApi.markAttendance(sessionId, status);
      await reload();
      if (updated.noteRequired) {
        selectTab('notes', sessionId);
        setMessage('Session completed. Please add the attending doctor’s SOAP note below.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    }
  };

  const handleNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteSessionId) return;
    setSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      await therapyApi.addNote(noteSessionId, note);
      setNote({});
      setMessage('Session note saved. Other doctors can see it on this case.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const startRecording = async () => {
    if (!noteSessionId) {
      setError('Select a completed session before recording a voice note');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setIsTranscribing(true);
      try {
        await therapyApi.addVoiceNote(noteSessionId, blob);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voice transcription failed');
      } finally {
        setIsTranscribing(false);
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const completedSessions = useMemo(
    () => (therapyCase?.sessions || []).filter((session) => session.status === 'COMPLETED'),
    [therapyCase],
  );

  const noteHistory = useMemo(() => {
    const rows: Array<{ sessionId: string; scheduledAt: string; doctorName?: string; note: TherapyNote }> = [];
    for (const session of therapyCase?.sessions || []) {
      for (const n of session.notes || []) {
        rows.push({
          sessionId: session.id,
          scheduledAt: session.scheduledAt,
          doctorName: session.doctor?.name,
          note: n,
        });
      }
    }
    return rows.sort(
      (a, b) => new Date(b.note.createdAt).getTime() - new Date(a.note.createdAt).getTime(),
    );
  }, [therapyCase]);

  if (isDoctorOnly) {
    return <Navigate to="/doctor/sessions" replace />;
  }

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!therapyCase) return <div className="p-8 text-gray-500">Case not found</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sessions', label: 'Sessions' },
    { key: 'packages', label: 'Packages' },
    { key: 'notes', label: 'Notes' },
    { key: 'progress', label: 'Progress' },
    { key: 'ai', label: 'AI Summary' },
  ];

  const pending = therapyCase.pendingDoctorNotes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link to="/therapy" className="btn-ghost mt-1"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold">{therapyCase.title}</h1>
            <p className="text-gray-500">
              <Link to={`/patients/${therapyCase.patientId}`} className="text-blue-600">{therapyCase.patient?.name}</Link>
              {' · '}{therapyCase.therapist?.name}
            </p>
          </div>
        </div>
        <span className={therapyCase.status === 'ACTIVE' ? 'badge-info' : 'badge-gray'}>{therapyCase.status}</span>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
      {message && <div className="p-4 rounded-lg bg-emerald-50 text-emerald-800 text-sm">{message}</div>}

      {therapyCase.assessment && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Assessment</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{therapyCase.assessment}</p>
        </div>
      )}

      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
            {t.key === 'notes' && pending.length > 0 && (
              <span className="ml-2 badge-warning">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'packages' && (
        <div className="space-y-4">
          <div className="card p-4 flex gap-2">
            <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">Assign a package...</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.totalSessions} sessions)</option>)}
            </select>
            <button type="button" className="btn-primary" onClick={handleAssign} disabled={!packageId}>Assign & generate sessions</button>
          </div>
          {(therapyCase.packages || []).map((p) => (
            <div key={p.id} className="card p-4 flex justify-between">
              <div>
                <p className="font-medium">{p.package?.name}</p>
                <p className="text-sm text-gray-500">{p.usedSessions} used / {p.remainingSessions} remaining</p>
              </div>
              <p className="text-sm">Expires {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '—'}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(therapyCase.sessions || []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm">{formatDate(s.scheduledAt)}</td>
                  <td className="px-4 py-3 text-sm">{s.doctor ? doctorLabel(s.doctor.name) : '—'}</td>
                  <td className="px-4 py-3 text-sm">{s.patientPackageId ? 'Package' : 'Session-wise'}</td>
                  <td className="px-4 py-3"><span className={SESSION_BADGE[s.status]}>{s.status}</span></td>
                  <td className="px-4 py-3">
                    {s.attendance ? (
                      <div className="space-y-1">
                        <span className="text-sm">{s.attendance.status}</span>
                        {s.status === 'COMPLETED' && pending.some((p) => p.sessionId === s.id) && (
                          <button
                            type="button"
                            className="block text-xs font-medium text-blue-600 hover:underline"
                            onClick={() => selectTab('notes', s.id)}
                          >
                            Add doctor note
                          </button>
                        )}
                      </div>
                    ) : s.status === 'SCHEDULED' ? (
                      <div className="flex gap-1">
                        <button type="button" className="btn-primary text-xs px-2 py-1" onClick={() => handleAttendance(s.id, 'PRESENT')}>Present</button>
                        <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => handleAttendance(s.id, 'ABSENT')}>Absent</button>
                        <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => handleAttendance(s.id, 'LATE')}>Late</button>
                      </div>
                    ) : null}
                    {s.status === 'SCHEDULED' && (
                      <div className="mt-2 flex gap-1">
                        <input
                          type="datetime-local"
                          className="input text-xs"
                          value={reschedule.sessionId === s.id ? reschedule.scheduledAt : ''}
                          onChange={(e) => setReschedule({ sessionId: s.id, scheduledAt: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn-outline text-xs"
                          disabled={reschedule.sessionId !== s.id || !reschedule.scheduledAt}
                          onClick={async () => {
                            await therapyApi.rescheduleSession(s.id, new Date(reschedule.scheduledAt).toISOString());
                            setReschedule({ sessionId: '', scheduledAt: '' });
                            await reload();
                          }}
                        >
                          Reschedule
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-900">Doctor notes pending after completed sessions</p>
              <p className="text-xs text-amber-800">
                After Present/Late, the attending doctor must add a SOAP note. All doctors on this case can read each other’s prior notes.
              </p>
              <ul className="space-y-1">
                {pending.map((item) => (
                  <li key={item.sessionId} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-950">
                    <span>
                      {formatDate(item.scheduledAt)}
                      {item.doctor ? ` · ${doctorLabel(item.doctor.name)}` : ''}
                    </span>
                    <button
                      type="button"
                      className="text-blue-700 font-medium hover:underline"
                      onClick={() => setNoteSessionId(item.sessionId)}
                    >
                      Add note
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleNote} className="card p-4 space-y-3">
            <div>
              <label className="label">Completed session</label>
              <select
                className="input"
                value={noteSessionId}
                onChange={(e) => setNoteSessionId(e.target.value)}
                required
              >
                <option value="">Select completed session</option>
                {completedSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.scheduledAt)}
                    {s.doctor ? ` · ${doctorLabel(s.doctor.name)}` : ''}
                    {pending.some((p) => p.sessionId === s.id) ? ' · note pending' : ''}
                  </option>
                ))}
              </select>
              {completedSessions.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">No completed sessions yet. Mark Present/Late on Sessions first.</p>
              )}
            </div>
            {SOAP_FIELDS.map((field) => (
              <textarea
                key={field.key}
                className="input"
                rows={2}
                placeholder={field.label}
                value={(note[field.key] as string) || ''}
                onChange={(e) => setNote({ ...note, [field.key]: e.target.value })}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="submit" disabled={savingNote || !noteSessionId}>
                {savingNote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Save doctor / clinical note
              </button>
              <button
                type="button"
                className={isRecording ? 'btn-danger' : 'btn-secondary'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || !noteSessionId}
              >
                {isTranscribing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isRecording ? <Square className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                {isTranscribing ? 'Transcribing…' : isRecording ? 'Stop recording' : 'Record voice draft'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Doctor notes are allowed only after the session is completed. Voice drafts must be approved before they become clinical records.
            </p>
          </form>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Note history (all doctors)</h2>
            {noteHistory.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-500">No notes on this case yet.</div>
            ) : (
              noteHistory.map(({ note: n, scheduledAt, doctorName }) => (
                <div key={n.id} className="card p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {n.authoredBy?.name || 'Unknown author'}
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {authorRole(n.authoredBy?.staffType)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Session {formatDate(scheduledAt)}
                        {doctorName ? ` · attending ${doctorLabel(doctorName)}` : ''}
                        {' · written '}
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {n.isAiDraft && !n.aiReviewed && <span className="badge-warning">AI draft</span>}
                      {n.isAiDraft && n.aiReviewed && <span className="badge-success">AI reviewed</span>}
                      {n.isAiDraft && !n.aiReviewed && (
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:underline"
                          onClick={async () => {
                            await therapyApi.updateNote(n.id, { aiReviewed: true });
                            await reload();
                          }}
                        >
                          Approve AI draft
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {SOAP_FIELDS.map((field) => {
                      const value = n[field.key];
                      if (!value || typeof value !== 'string') return null;
                      return (
                        <div key={field.key} className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{field.label}</p>
                          <p className="text-slate-800 whitespace-pre-wrap mt-0.5">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <div className="space-y-4">
          <form
            className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!id) return;
              await therapyApi.addProgress(id, { metric: metric.metric, value: metric.value ? Number(metric.value) : undefined, note: metric.note });
              setMetric({ metric: '', value: '', note: '' });
              await reload();
            }}
          >
            <input className="input" placeholder="Metric" value={metric.metric} onChange={(e) => setMetric({ ...metric, metric: e.target.value })} required />
            <input className="input" placeholder="Value" value={metric.value} onChange={(e) => setMetric({ ...metric, value: e.target.value })} />
            <input className="input" placeholder="Note" value={metric.note} onChange={(e) => setMetric({ ...metric, note: e.target.value })} />
            <button className="btn-primary" type="submit">Record</button>
          </form>
          {(therapyCase.progress || []).map((p) => (
            <div key={p.id} className="card p-4 flex justify-between">
              <div>
                <p className="font-medium">{p.metric}</p>
                <p className="text-sm text-gray-500">{p.note}</p>
              </div>
              <p>{p.value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            AI output is a draft only. It is not a clinical record until a therapist approves it.
          </div>
          <button type="button" className="btn-primary" onClick={async () => { if (!id) return; await therapyApi.generateSummary(id); await reload(); }}>
            Generate AI summary draft
          </button>
          {(therapyCase.aiSummaries || []).map((s) => (
            <div key={s.id} className="card p-4 space-y-2">
              <div className="flex justify-between">
                <span className={s.isReviewed ? 'badge-success' : 'badge-warning'}>{s.isReviewed ? 'Reviewed' : 'Draft — needs review'}</span>
                {!s.isReviewed && (
                  <button type="button" className="btn-primary text-sm" onClick={async () => { await therapyApi.reviewSummary(s.id, true); await reload(); }}>
                    Approve
                  </button>
                )}
              </div>
              <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700">{s.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
