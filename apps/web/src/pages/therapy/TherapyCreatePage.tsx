import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Search, User, Pill, Package } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import type { TherapyPackage } from '../../types/therapy';

type OpHit = { id: string; createdAt: string; chiefComplaint?: string | null; status?: string };

export function TherapyCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetPatientId = params.get('patientId') || '';
  const presetOpCaseId = params.get('opCaseId') || '';

  const [patientId, setPatientId] = useState(presetPatientId);
  const [opCaseId, setOpCaseId] = useState(presetOpCaseId);
  const [patientLabel, setPatientLabel] = useState('');
  const [opCases, setOpCases] = useState<OpHit[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [therapists, setTherapists] = useState<{ id: string; name: string }[]>([]);
  const [packages, setPackages] = useState<TherapyPackage[]>([]);
  const [therapistId, setTherapistId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [title, setTitle] = useState('');
  const [assessment, setAssessment] = useState('');
  const [goals, setGoals] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    therapyApi.getTherapists().then(setTherapists).catch(console.error);
    therapyApi.getPackages().then((res) => {
      const list = (res.data || []).filter((p) => p.isActive !== false);
      setPackages(list);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    patientsApi.getById<{ name: string; patientNumber: string }>(patientId).then((p) => {
      setPatientLabel(`${p.name} (${p.patientNumber})`);
    }).catch(() => undefined);
  }, [patientId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientId || query.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        setResults(await patientsApi.search(query.trim(), 10, { opRegistered: true }));
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Patient search failed');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, patientId]);

  const selectPatient = (hit: PatientSearchHit) => {
    setError(null);
    setPatientId(hit.id);
    setPatientLabel(`${hit.name} (${hit.patientNumber})`);
    const cases = (hit.opCases || []).filter((op): op is OpHit => Boolean(op.id));
    setOpCases(cases);
    setOpCaseId(presetOpCaseId || cases[0]?.id || '');
    setResults([]);
    setQuery('');
    if (!title && cases[0]?.chiefComplaint) {
      setTitle(`Therapy — ${cases[0].chiefComplaint}`);
    }
  };

  const clearPatient = () => {
    setPatientId('');
    setOpCaseId('');
    setPatientLabel('');
    setOpCases([]);
    setQuery('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !therapistId || !title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const created = await therapyApi.createCase({
        patientId,
        opCaseId: opCaseId || undefined,
        therapistId,
        title: title.trim(),
        assessment: assessment || undefined,
        goals: goals ? goals.split('\n').filter(Boolean).map((text) => ({ text, status: 'ACTIVE' })) : undefined,
      });
      if (packageId) {
        await therapyApi.assignPackage(created.id, { packageId });
      }
      navigate(`/therapy/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create therapy case');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPackage = packages.find((p) => p.id === packageId);

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Therapy registration</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              OP patient *
            </h2>
            {patientId ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm font-medium text-green-800">{patientLabel || patientId}</span>
                  {!presetPatientId && (
                    <button type="button" className="text-sm text-blue-600" onClick={clearPatient}>Change</button>
                  )}
                </div>
                {opCases.length > 1 && (
                  <select className="input" value={opCaseId} onChange={(e) => setOpCaseId(e.target.value)}>
                    {opCases.map((op) => (
                      <option key={op.id} value={op.id}>
                        OP {new Date(op.createdAt).toLocaleDateString('en-IN')} — {op.chiefComplaint || 'OP visit'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  type="search"
                  autoComplete="off"
                  placeholder="Name, phone, or patient ID"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(null); }}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow max-h-40 overflow-y-auto">
                    {results.map((hit) => (
                      <button
                        type="button"
                        key={hit.id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                        onClick={() => selectPatient(hit)}
                      >
                        <p className="font-medium text-gray-900">{hit.name}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {hit.patientNumber}{hit.phone ? ` · ${hit.phone}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="mt-1 text-xs text-amber-800">No OP-registered patient found.</p>
                )}
                {query.trim().length > 0 && query.trim().length < 2 && (
                  <p className="mt-1 text-xs text-gray-500">Type at least 2 characters.</p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Doctor *
            </h2>
            <select className="input" value={therapistId} onChange={(e) => setTherapistId(e.target.value)} required>
              <option value="">Select doctor</option>
              {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {therapists.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">No doctors in staff. Add a DOCTOR user first.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              Therapy title *
            </h2>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Speech therapy"
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Package
            </h2>
            <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">No package yet</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.totalSessions} sessions · {String(p.frequency).replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
            {selectedPackage && (
              <p className="mt-1 text-xs text-gray-500">
                {selectedPackage.totalSessions} sessions
                {selectedPackage.validityDays ? ` · ${selectedPackage.validityDays} days` : ''}
                {selectedPackage.price != null ? ` · ₹${selectedPackage.price}` : ''}
              </p>
            )}
            {packages.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                No catalog packages.{' '}
                <Link to="/therapy/packages" className="text-blue-600">Create a package</Link>
              </p>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Assessment</label>
            <input className="input" value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Goals</label>
            <input className="input" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Optional — separate with commas or lines" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn-primary" disabled={isLoading || !patientId || !therapistId || !title.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start therapy'}
          </button>
        </div>
      </form>
    </div>
  );
}
