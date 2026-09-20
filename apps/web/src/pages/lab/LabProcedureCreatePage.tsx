import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FlaskConical, Loader2, Edit2, Trash2, X, CheckCircle } from 'lucide-react';
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

  // Edit state
  const [editingProc, setEditingProc] = useState<LabProcedure | null>(null);
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    department: 'Audiology',
    sampleType: 'NONE' as LabSampleType,
    price: 0,
    tatHours: 24,
    instructions: '',
    isActive: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingProc, setDeletingProc] = useState<LabProcedure | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Failed to load audio masters');
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
      setSaved(`Saved ${created.code} — ${created.name}`);
      setTimeout(() => setSaved(null), 4000);
      setForm({ ...emptyForm, department: form.department, sampleType: form.sampleType });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create procedure');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (proc: LabProcedure) => {
    setEditingProc(proc);
    setEditForm({
      code: proc.code,
      name: proc.name,
      department: proc.department,
      sampleType: proc.sampleType,
      price: Number(proc.price),
      tatHours: proc.tatHours,
      instructions: proc.instructions || '',
      isActive: proc.isActive !== false,
    });
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProc) return;
    setIsUpdating(true);
    setError(null);
    try {
      await labApi.updateProcedure(editingProc.id, {
        code: editForm.code.trim().toUpperCase(),
        name: editForm.name.trim(),
        department: editForm.department,
        sampleType: editForm.sampleType,
        price: Number(editForm.price),
        tatHours: Number(editForm.tatHours),
        instructions: editForm.instructions.trim() || undefined,
        isActive: editForm.isActive,
      });
      setEditingProc(null);
      setSaved(`Updated ${editForm.code} — ${editForm.name}`);
      setTimeout(() => setSaved(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update audio master');
    } finally {
      setIsUpdating(false);
    }
  };

  const onDelete = async () => {
    if (!deletingProc) return;
    setIsDeleting(true);
    setError(null);
    try {
      await labApi.deleteProcedure(deletingProc.id);
      setDeletingProc(null);
      setSaved(`Deleted ${deletingProc.code} — ${deletingProc.name}`);
      setTimeout(() => setSaved(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete audio master');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <FlaskConical className="w-6 h-6 text-blue-600" /> Audio masters
          </h1>
          <p className="text-sm text-gray-500">Manage audiology diagnostic procedures, test codes, TAT, and prices.</p>
        </div>
        <Link to="/lab" className="btn-ghost text-sm">Dashboard</Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saved}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border shadow-sm">
        <div>
          <label className="label text-xs">Code *</label>
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="e.g. PTA" />
        </div>
        <div className="col-span-2">
          <label className="label text-xs">Procedure name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Pure Tone Audiometry" />
        </div>
        <div>
          <label className="label text-xs">Department *</label>
          <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Sample</label>
          <select className="input" value={form.sampleType} onChange={(e) => setForm({ ...form, sampleType: e.target.value as LabSampleType })}>
            {sampleTypes.map((t) => <option key={t} value={t}>{SAMPLE_LABEL[t] || t}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Price (₹) *</label>
          <input className="input" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="label text-xs">TAT (hours)</label>
          <input className="input" type="number" min={1} value={form.tatHours} onChange={(e) => setForm({ ...form, tatHours: Number(e.target.value) })} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="label text-xs">Instructions (optional)</label>
          <input className="input" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Optional prep or patient instructions" />
        </div>
        <div className="col-span-2 md:col-span-4 flex justify-end pt-1 border-t">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Audio Master
          </button>
        </div>
      </form>

      {/* Edit Modal */}
      {editingProc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" /> Edit Audio Master
              </h2>
              <button onClick={() => setEditingProc(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onUpdate} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs">Code *</label>
                  <input className="input" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} required />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Name *</label>
                  <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Department *</label>
                  <select className="input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} required>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Sample</label>
                  <select className="input" value={editForm.sampleType} onChange={(e) => setEditForm({ ...editForm, sampleType: e.target.value as LabSampleType })}>
                    {sampleTypes.map((t) => <option key={t} value={t}>{SAMPLE_LABEL[t] || t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Price (₹) *</label>
                  <input className="input" type="number" min={0} step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} required />
                </div>
                <div>
                  <label className="label text-xs">TAT (hours)</label>
                  <input className="input" type="number" min={1} value={editForm.tatHours} onChange={(e) => setEditForm({ ...editForm, tatHours: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Instructions</label>
                <input className="input" value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-proc-active"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                <label htmlFor="edit-proc-active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (available in billing &amp; diagnostics)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="btn-secondary" onClick={() => setEditingProc(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Update Procedure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Audio Master</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong className="text-gray-900">{deletingProc.code} — {deletingProc.name}</strong>?
              If this test is already billed in past invoices, it will be safely deactivated.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" className="btn-secondary" onClick={() => setDeletingProc(null)} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="btn-danger bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg font-medium text-sm" onClick={onDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1 inline" /> : null}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden bg-white border">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">TAT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {procedures.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{p.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.department}</td>
                  <td className="px-4 py-3 text-gray-600">{SAMPLE_LABEL[p.sampleType] || p.sampleType}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{rupees(p.price)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.tatHours}h</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium flex items-center gap-1"
                        title="Edit procedure"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProc(p)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1"
                        title="Delete procedure"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {procedures.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>No audio procedures in the catalog yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
