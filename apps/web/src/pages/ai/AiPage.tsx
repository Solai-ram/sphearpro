import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Brain, CheckCircle, Loader2, Mic, Sparkles } from 'lucide-react';
import { aiApi, type AiRequestRow, type AiStatus } from '../../services/ai';
import { therapyApi } from '../../services/therapy';

type Tab = 'overview' | 'transcribe' | 'history';

export function AiPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [requests, setRequests] = useState<AiRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [soap, setSoap] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [caseQuery, setCaseQuery] = useState('');
  const [cases, setCases] = useState<Array<{ id: string; title: string; patient?: { name: string } }>>([]);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [st, us, list] = await Promise.all([aiApi.status(), aiApi.usage(), aiApi.listRequests()]);
      setStatus(st);
      setUsage(us);
      setRequests(list.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI console');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setSoap(null);
    try {
      const result = await aiApi.transcribe(file);
      setTranscript(result.text);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const draftSoap = async () => {
    if (!transcript.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiApi.noteDraft(transcript);
      setSoap(result.soap);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Note draft failed');
    } finally {
      setBusy(false);
    }
  };

  const searchCases = async () => {
    const result = await therapyApi.getCases({ search: caseQuery, limit: 8, page: 1 });
    setCases(result.data || []);
  };

  const generateCaseSummary = async (caseId: string) => {
    setBusy(true);
    setError(null);
    try {
      const summary = await therapyApi.generateSummary(caseId);
      setSummaryResult(summary.content || 'Draft generated. Open the therapy case to approve it as a clinical record.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summary failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI console</h1>
        <p className="text-gray-500">Assistance only — drafts never become clinical records until a clinician approves them on the case.</p>
      </div>

      <div className="p-4 rounded-lg bg-amber-50 text-amber-900 text-sm flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        Pipeline is strictly AI → draft → human review → approve. Reviewing here only flags the draft; it does not write notes, diagnoses, or summaries into the patient chart.
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <div className="flex gap-2 border-b">
        {([
          ['overview', 'Overview'],
          ['transcribe', 'Transcribe & draft'],
          ['history', 'Request history'],
        ] as const).map(([id, label]) => (
          <button key={id} className={`px-4 py-2 text-sm font-medium ${tab === id ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : tab === 'overview' && status ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Gemini (summaries / SOAP drafts)</p>
              <p className="font-semibold">{status.gemini.configured ? 'Configured' : 'API key missing'}</p>
              <p className="text-xs text-gray-500">{status.gemini.model}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">ElevenLabs (speech-to-text)</p>
              <p className="font-semibold">{status.elevenlabs.configured ? 'Configured' : 'API key missing'}</p>
              <p className="text-xs text-gray-500">{status.elevenlabs.model}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Pending draft review</p>
              <p className="text-2xl font-semibold">{usage?.pendingReview ?? 0}</p>
            </div>
            {(usage?.usage || []).slice(0, 3).map((row: any) => (
              <div key={`${row.provider}-${row.requestType}`} className="card p-4">
                <p className="text-sm text-gray-500">{row.provider} · {row.requestType}</p>
                <p className="text-2xl font-semibold">{row.requests}</p>
                <p className="text-xs text-gray-500">{row.promptTokens + row.completionTokens} tokens</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">Therapy summaries are approved on the <Link className="text-blue-700" to="/therapy">therapy case</Link>, not from this console.</p>
        </div>
      ) : tab === 'transcribe' ? (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Mic className="w-4 h-4" /> Voice transcript (draft)</h2>
            <input className="input" type="file" accept="audio/*,.webm,.mp3,.wav,.m4a" onChange={onAudio} disabled={busy} />
            <textarea className="input min-h-[140px]" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcript appears here. You can edit before drafting SOAP." />
            <button className="btn-primary" type="button" disabled={busy || !transcript.trim()} onClick={draftSoap}>
              <Sparkles className="w-4 h-4 mr-2" /> {busy ? 'Working…' : 'Draft SOAP from transcript'}
            </button>
            {soap && (
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                {Object.entries(soap).map(([key, value]) => (
                  <div key={key} className="p-2 rounded bg-gray-50">
                    <p className="font-medium capitalize">{key}</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4" /> Therapy case summary (draft)</h2>
            <div className="flex gap-2">
              <input className="input" placeholder="Search therapy cases" value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} />
              <button className="btn-secondary" type="button" onClick={searchCases}>Search</button>
            </div>
            {cases.map((item) => (
              <div key={item.id} className="flex justify-between items-center border-t py-2">
                <span>{item.title} {item.patient?.name ? `· ${item.patient.name}` : ''}</span>
                <button className="btn-primary text-sm" disabled={busy} onClick={() => generateCaseSummary(item.id)}>Generate draft</button>
              </div>
            ))}
            {summaryResult && <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded">{summaryResult}</p>}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Type</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Draft</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((row) => {
                const output = row.outputs[0];
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-3">{row.type}</td>
                    <td className="p-3">{row.provider}{row.model ? ` · ${row.model}` : ''}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3 max-w-md">
                      <p className="whitespace-pre-wrap text-gray-700 line-clamp-6">{output?.content || '—'}</p>
                      {output && (
                        <p className="text-xs mt-1">{output.isReviewed ? 'Reviewed (still not a chart write)' : 'Unreviewed draft'}</p>
                      )}
                    </td>
                    <td className="p-3">
                      {output && !output.isReviewed && (
                        <button
                          className="text-blue-700 inline-flex items-center gap-1"
                          onClick={async () => {
                            await aiApi.reviewOutput(output.id);
                            await load();
                          }}
                        >
                          <CheckCircle className="w-4 h-4" /> Mark reviewed
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && <p className="p-6 text-gray-500">No AI requests yet</p>}
        </div>
      )}
    </div>
  );
}
