import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FlaskConical, Loader2 } from 'lucide-react';
import { labApi } from '../../services/lab';
import type { LabProcedure, LabSampleType } from '../../types/lab';

const SAMPLE_LABEL: Record<LabSampleType, string> = {
  NONE: 'None',
  BLOOD: 'Blood',
  SERUM: 'Serum',
  URINE: 'Urine',
  SWAB: 'Swab',
  SPUTUM: 'Sputum',
  OTHER: 'Other',
};

function rupees(value?: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

const emptyForm = {
  code: '',
  name: '',
  department: 'Audiology',
  sampleType: 'NONE' as LabSampleType,
  price: 0,
  tatHours: 24,
  instructions: '',
};

export function LabProcedureCreatePage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [sampleTypes, setSampleTypes] = useState<LabSampleType[]>([]);
  const [procedures, setProcedures] = useState<LabProcedure[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [dept, types, list] = await Promise.all([
        labApi.getDepartments(),
        labApi.getSampleTypes(),
        labApi.getProcedures({ limit: 100 }),
      ]);
      setDepartments(dept);
      setSampleTypes(types);
      setProcedures(list.data || []);
      setForm((prev) => ({ ...prev, department: prev.department || dept[0] || 'Audiology' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audio procedures');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const created = await labApi.createProcedure({
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        instructions: form.instructions.trim() || undefined,
      });
      setSaved(`${created.code} — ${created.name}`);
      setForm({ ...emptyForm, department: form.department, sampleType: form.sampleType });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create procedure');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" /> Audio procedure creation
          </h1>
          <p className="text-sm text-gray-500">Add a test to the audio catalog.</p>
        </div>
        <Link to="/lab" className="btn-ghost text-sm">Dashboard</Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm">Saved {saved}.</div>
      )}

      <form onSubmit={onSubmit} className="card p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="label">Code *</label>
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="PTA" />
        </div>
        <div className="col-span-2">
          <label className="label">Procedure name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Pure Tone Audiometry" />
        </div>
        <div>
          <label className="label">Department *</label>
          <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sample</label>
          <select className="input" value={form.sampleType} onChange={(e) => setForm({ ...form, sampleType: e.target.value as LabSampleType })}>
            {sampleTypes.map((t) => <option key={t} value={t}>{SAMPLE_LABEL[t] || t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Price (₹) *</label>
          <input className="input" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="label">TAT (hours)</label>
          <input className="input" type="number" min={1} value={form.tatHours} onChange={(e) => setForm({ ...form, tatHours: Number(e.target.value) })} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="label">Instructions</label>
          <input className="input" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Optional prep / sample notes" />
        </div>
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save procedure
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sample</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">TAT</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {procedures.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{p.department}</td>
                  <td className="px-3 py-2">{SAMPLE_LABEL[p.sampleType] || p.sampleType}</td>
                  <td className="px-3 py-2 text-right">{rupees(p.price)}</td>
                  <td className="px-3 py-2 text-right">{p.tatHours}h</td>
                </tr>
              ))}
              {procedures.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>No procedures in the catalog yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
