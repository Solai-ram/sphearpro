import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Mic, Sparkles, Square } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import { aiApi } from '../../services/ai';
import type { TherapyNote } from '../../types/therapy';

type Outcome = 'COMPLETED' | 'CANCELLED' | 'ABSENT';
type Tab = 'previous' | 'current';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function doctorLabel(name?: string) {
  if (!name) return 'Doctor';
  return `Dr. ${name.replace(/^Dr\.?\s*/i, '')}`;
}

function authorRole(staffType?: string) {
  if (staffType === 'DOCTOR') return 'Doctor';
  return staffType || 'Staff';
}

function noteBody(n: TherapyNote) {
  return [
    n.subjective,
    n.objective,
    n.activities,
    n.observations,
    n.progress,
    n.challenges,
    n.nextPlan,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n\n');
}

export function DoctorSessionWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('current');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Awaited<
    ReturnType<typeof therapyApi.getDoctorSessionWorkspace>
  > | null>(null);
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [noteText, setNoteText] = useState('');
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const load = async (opts?: { silent?: boolean }) => {
    if (!sessionId) return;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await therapyApi.getDoctorSessionWorkspace(sessionId);
      setWorkspace(data);
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
        setWorkspace(null);
      }
      throw err;
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const onNoteChange = (value: string) => {
    setNoteText(value);
    if (isAiDraft) {
      setDraftConfirmed(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
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
          const draft = await aiApi.transcribe(blob, undefined, { toEnglish: true });
          setNoteText(draft.text || '');
          setOriginalTranscript(draft.originalText || null);
          setIsAiDraft(true);
          setDraftConfirmed(false);
          setMessage('Voice draft ready in English. Review, confirm it is correct, then save.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice transcription failed');
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const summarizePriorNotes = async () => {
    if (!workspace?.therapyCase.id) return;
    if (workspace.priorNotes.length === 0) {
      setError('No previous notes to summarize');
      return;
    }
    setSummarizing(true);
    setError(null);
    setMessage(null);
    try {
      await therapyApi.generateSummary(workspace.therapyCase.id);
      try {
        await load({ silent: true });
      } catch {
        // Summary may have saved even if refresh fails
      }
      setMessage('Overall notes summary draft ready. Review it above the list — approve when correct.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to generate summary';
      setError(
        raw.toLowerCase().includes('fetch failed')
          ? 'Summarize failed: cannot reach Gemini. Check API key/model and that the API server is running.'
          : raw,
      );
    } finally {
      setSummarizing(false);
    }
  };

  const save = async () => {
    if (!sessionId || !outcome) return;
    if (outcome === 'COMPLETED' && isAiDraft && !draftConfirmed) {
      setError('Confirm the AI draft is correct before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await therapyApi.recordDoctorSessionOutcome(sessionId, {
        outcome,
        ...(outcome === 'COMPLETED' ? { subjective: noteText.trim() } : {}),
      });
      setMessage(
        outcome === 'COMPLETED'
          ? 'Session completed and note saved.'
          : `Session marked ${outcome.toLowerCase()}.`,
      );
      await load();
      setTimeout(() => navigate('/doctor/sessions'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="space-y-3 max-w-3xl">
        <Link to="/doctor/sessions" className="text-sm text-blue-600 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to my sessions
        </Link>
        <div className="card p-8 text-center text-red-600">{error || 'Session not found'}</div>
      </div>
    );
  }

  const { session, therapyCase, priorNotes } = workspace;
  const patient = therapyCase.patient;
  const alreadyDone = session.status !== 'SCHEDULED' || Boolean(session.attendance);
  const noteReady =
    Boolean(noteText.trim())
    && (!isAiDraft || draftConfirmed);
  const canSave =
    !alreadyDone
    && Boolean(outcome)
    && (outcome !== 'COMPLETED' || noteReady)
    && !isRecording
    && !isTranscribing;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/doctor/sessions" className="text-sm text-blue-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to my sessions
      </Link>

      <div>
        <h1 className="page-title">{patient?.name || 'Patient'}</h1>
        <p className="page-subtitle">
          <span className="font-mono text-xs">{patient?.patientNumber}</span>
          {' · '}
          {therapyCase.title}
          {' · '}
          {formatWhen(session.scheduledAt)}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-2 border-b">
        {(
          [
            { key: 'previous' as const, label: 'Previous records' },
            { key: 'current' as const, label: 'Current session' },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'previous' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              {priorNotes.length} prior note{priorNotes.length === 1 ? '' : 's'} on this case
            </p>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={summarizing || priorNotes.length === 0}
              onClick={summarizePriorNotes}
              title="Create one short overall summary of all prior notes"
            >
              {summarizing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {summarizing ? 'Summarizing…' : 'Summarize all notes'}
            </button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Summarize creates one short overall draft of all prior notes. It is not a clinical record until you approve it.
          </div>

          {(workspace.aiSummaries || []).map((s) => (
            <div key={s.id} className="card p-4 space-y-2 border-blue-100 bg-blue-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">Overall notes summary</span>
                  <span className={s.isReviewed ? 'badge-success' : 'badge-warning'}>
                    {s.isReviewed ? 'Reviewed' : 'AI draft'}
                  </span>
                </div>
                {!s.isReviewed && (
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-700 hover:underline"
                    onClick={async () => {
                      try {
                        await therapyApi.reviewSummary(s.id, true);
                        await load();
                        setMessage('Summary marked as reviewed.');
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to approve summary');
                      }
                    }}
                  >
                    Approve draft
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {new Date(s.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800">{s.content}</pre>
            </div>
          ))}

          {priorNotes.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">
              No previous notes on this therapy case yet.
            </div>
          ) : (
            priorNotes.map((n) => (
              <div key={n.id} className="card p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {n.authoredBy?.name || 'Unknown'}
                      <span className="ml-2 text-xs font-medium text-gray-500">
                        {authorRole(n.authoredBy?.staffType)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Session {formatWhen(n.scheduledAt)}
                      {n.sessionDoctor ? ` · ${doctorLabel(n.sessionDoctor.name)}` : ''}
                    </p>
                  </div>
                  {n.isAiDraft && !n.aiReviewed && <span className="badge-warning">AI draft</span>}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {noteBody(n) || '—'}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'current' && (
        <div className="space-y-4">
          {alreadyDone ? (
            <div className="card p-5 space-y-2">
              <p className="font-medium text-gray-900">This session is already recorded</p>
              <p className="text-sm text-gray-600">
                Status: <span className="font-medium">{session.status}</span>
                {session.attendance ? ` · Attendance: ${session.attendance.status}` : ''}
              </p>
              {(session.notes || []).length > 0 && (
                <p className="text-sm text-gray-600">
                  {(session.notes || []).length} note(s) on file — see Previous records.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Session status</h2>
                <p className="text-xs text-gray-500">
                  Only you (the assigned doctor) can record this visit.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: 'COMPLETED' as const, label: 'Completed' },
                      { value: 'CANCELLED' as const, label: 'Cancelled' },
                      { value: 'ABSENT' as const, label: 'Absent' },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={
                        outcome === opt.value
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }
                      onClick={() => setOutcome(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {outcome === 'COMPLETED' && (
                <div className="card p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-gray-900">Session notes (required)</h2>
                  <p className="text-xs text-gray-500">
                    Type notes, or record voice. Voice is transcribed with ElevenLabs, translated to English as an AI draft — you must confirm before saving.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={isRecording ? 'btn-danger' : 'btn-secondary'}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing || saving}
                    >
                      {isTranscribing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : isRecording ? (
                        <Square className="w-4 h-4 mr-2" />
                      ) : (
                        <Mic className="w-4 h-4 mr-2" />
                      )}
                      {isTranscribing
                        ? 'Transcribing & translating…'
                        : isRecording
                          ? 'Stop recording'
                          : 'Record note'}
                    </button>
                  </div>

                  {isAiDraft && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-sm font-medium text-amber-900">AI draft — not a clinical record yet</p>
                      <p className="text-xs text-amber-800">
                        Review the English draft below. Edit if needed, then confirm it is correct before saving.
                      </p>
                      {originalTranscript && (
                        <details className="text-xs text-amber-900/80">
                          <summary className="cursor-pointer font-medium">Original transcript</summary>
                          <p className="mt-1 whitespace-pre-wrap">{originalTranscript}</p>
                        </details>
                      )}
                      <label className="flex items-start gap-2 text-sm text-amber-950">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={draftConfirmed}
                          onChange={(e) => setDraftConfirmed(e.target.checked)}
                        />
                        <span>I confirm this note is correct and ready to save as the clinical record.</span>
                      </label>
                    </div>
                  )}

                  <textarea
                    className="input min-h-[12rem]"
                    rows={10}
                    placeholder="Enter session notes, or use Record…"
                    value={noteText}
                    onChange={(e) => onNoteChange(e.target.value)}
                    disabled={isTranscribing}
                  />
                </div>
              )}

              {(outcome === 'CANCELLED' || outcome === 'ABSENT') && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  No clinical note is required for {outcome.toLowerCase()} sessions.
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                disabled={!canSave || saving}
                onClick={save}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {outcome === 'COMPLETED' ? 'Save completed session & notes' : 'Save session status'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
