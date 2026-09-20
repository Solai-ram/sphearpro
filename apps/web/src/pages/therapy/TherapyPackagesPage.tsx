import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Plus, Edit2, Trash2, X, CheckCircle } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import type { TherapyPackage, TherapyType, SessionFrequency } from '../../types/therapy';

const FREQUENCIES: SessionFrequency[] = [
  'WEEKLY', 'TWICE_WEEKLY', 'THREE_TIMES_WEEKLY', 'DAILY', 'EVERY_TWO_WEEKS', 'MONTHLY', 'CUSTOM',
];

export function TherapyPackagesPage() {
  const [packages, setPackages] = useState<TherapyPackage[]>([]);
  const [types, setTypes] = useState<TherapyType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    therapyTypeId: '',
    name: '',
    totalSessions: 12,
    frequency: 'WEEKLY' as SessionFrequency,
    price: 10000,
    validityDays: 90,
  });

  // Edit state
  const [editingPkg, setEditingPkg] = useState<TherapyPackage | null>(null);
  const [editForm, setEditForm] = useState({
    therapyTypeId: '',
    name: '',
    totalSessions: 12,
    frequency: 'WEEKLY' as SessionFrequency,
    price: 10000,
    validityDays: 90,
    isActive: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingPkg, setDeletingPkg] = useState<TherapyPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [pkg, typeList] = await Promise.all([therapyApi.getPackages(), therapyApi.getTypes()]);
      setPackages(pkg.data);
      setTypes(typeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load therapy masters');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await therapyApi.createPackage(form);
      setShowForm(false);
      setSuccessMsg(`Created package "${form.name}"`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    }
  };

  const startEdit = (pkg: TherapyPackage) => {
    setEditingPkg(pkg);
    setEditForm({
      therapyTypeId: pkg.therapyTypeId || (pkg.therapyType?.id || ''),
      name: pkg.name,
      totalSessions: pkg.totalSessions,
      frequency: pkg.frequency,
      price: Number(pkg.price),
      validityDays: pkg.validityDays ?? 90,
      isActive: pkg.isActive !== false,
    });
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPkg) return;
    setIsUpdating(true);
    setError(null);
    try {
      await therapyApi.updatePackage(editingPkg.id, {
        name: editForm.name.trim(),
        therapyTypeId: editForm.therapyTypeId,
        totalSessions: Number(editForm.totalSessions),
        frequency: editForm.frequency,
        price: Number(editForm.price),
        validityDays: Number(editForm.validityDays),
        isActive: editForm.isActive,
      });
      setEditingPkg(null);
      setSuccessMsg(`Updated package "${editForm.name}"`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package');
    } finally {
      setIsUpdating(false);
    }
  };

  const onDelete = async () => {
    if (!deletingPkg) return;
    setIsDeleting(true);
    setError(null);
    try {
      await therapyApi.deletePackage(deletingPkg.id);
      setDeletingPkg(null);
      setSuccessMsg(`Deleted package "${deletingPkg.name}"`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete package');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/therapy" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Therapy masters</h1>
            <p className="text-sm text-gray-500">Manage therapy packages, session counts, frequencies, and prices.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> New Package
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border shadow-sm">
          <div>
            <label className="label text-xs">Therapy Type *</label>
            <select className="input" value={form.therapyTypeId} onChange={(e) => setForm({ ...form, therapyTypeId: e.target.value })} required>
              <option value="">-- Choose therapy type --</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Package Name *</label>
            <input className="input" placeholder="e.g. Speech Therapy 12 Sessions" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label text-xs">Total Sessions *</label>
            <input className="input" type="number" min={1} value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="label text-xs">Frequency</label>
            <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as SessionFrequency })}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Price (₹) *</label>
            <input className="input" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="label text-xs">Validity (Days)</label>
            <input className="input" type="number" min={1} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t">
            <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" type="submit">Save Package</button>
          </div>
        </form>
      )}

      {/* Edit Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" /> Edit Therapy Master
              </h2>
              <button onClick={() => setEditingPkg(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onUpdate} className="space-y-3">
              <div>
                <label className="label text-xs">Therapy Type *</label>
                <select className="input" value={editForm.therapyTypeId} onChange={(e) => setEditForm({ ...editForm, therapyTypeId: e.target.value })} required>
                  <option value="">-- Choose therapy type --</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Package Name *</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Total Sessions *</label>
                  <input className="input" type="number" min={1} value={editForm.totalSessions} onChange={(e) => setEditForm({ ...editForm, totalSessions: Number(e.target.value) })} required />
                </div>
                <div>
                  <label className="label text-xs">Frequency</label>
                  <select className="input" value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value as SessionFrequency })}>
                    {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Price (₹) *</label>
                  <input className="input" type="number" min={0} step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} required />
                </div>
                <div>
                  <label className="label text-xs">Validity (Days)</label>
                  <input className="input" type="number" min={1} value={editForm.validityDays} onChange={(e) => setEditForm({ ...editForm, validityDays: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                <label htmlFor="edit-is-active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (available for new therapy cases &amp; billing)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="btn-secondary" onClick={() => setEditingPkg(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Update Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Therapy Master</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong className="text-gray-900">{deletingPkg.name}</strong>?
              If this package is already referenced in past cases or invoices, it will be safely deactivated.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" className="btn-secondary" onClick={() => setDeletingPkg(null)} disabled={isDeleting}>
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
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.therapyType?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.totalSessions}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.frequency.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
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
                        title="Edit package"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingPkg(p)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1"
                        title="Delete package"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No therapy packages yet. Click "New Package" above to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
