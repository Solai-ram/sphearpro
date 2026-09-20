import { useEffect, useState } from 'react';
import { AlertCircle, ListChecks, Loader2, Edit2, Trash2, X, CheckCircle } from 'lucide-react';
import { servicesApi, type ServiceMaster, type ServiceMasterCategory } from '../../services/services';

function rupees(value?: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

const emptyForm = {
  name: '',
  category: 'CONSULTATION' as ServiceMasterCategory,
  price: 0,
  discount: 0,
  description: '',
};

export function ServiceMasterPage() {
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Edit state
  const [editingService, setEditingService] = useState<ServiceMaster | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'CONSULTATION' as ServiceMasterCategory,
    price: 0,
    discount: 0,
    description: '',
    isActive: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingService, setDeletingService] = useState<ServiceMaster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const list = await servicesApi.list({ limit: 200 });
      setServices(list.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const created = await servicesApi.create({
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        discount: Number(form.discount || 0),
        description: form.description.trim() || undefined,
      });
      setSaved(`Created ${created.name} (${rupees(created.price)})`);
      setTimeout(() => setSaved(null), 4000);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: ServiceMaster) => {
    setEditingService(row);
    setEditForm({
      name: row.name,
      category: row.category || 'CONSULTATION',
      price: Number(row.price),
      discount: Number(row.discount || 0),
      description: row.description || '',
      isActive: row.isActive !== false,
    });
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setIsUpdating(true);
    setError(null);
    try {
      await servicesApi.update(editingService.id, {
        name: editForm.name.trim(),
        category: editForm.category,
        price: Number(editForm.price),
        discount: Number(editForm.discount || 0),
        description: editForm.description.trim() || undefined,
        isActive: editForm.isActive,
      });
      setEditingService(null);
      setSaved(`Updated ${editForm.name}`);
      setTimeout(() => setSaved(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setIsUpdating(false);
    }
  };

  const onDelete = async () => {
    if (!deletingService) return;
    setIsDeleting(true);
    setError(null);
    try {
      await servicesApi.delete(deletingService.id);
      setDeletingService(null);
      setSaved(`Deleted service "${deletingService.name}"`);
      setTimeout(() => setSaved(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async (row: ServiceMaster) => {
    setError(null);
    try {
      await servicesApi.update(row.id, { isActive: !row.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <ListChecks className="w-6 h-6 text-blue-600" /> Service masters
          </h1>
          <p className="text-sm text-gray-500">
            Create and manage priced services used in OP registration, review, and billing.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saved}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border shadow-sm">
        <div>
          <label className="label text-xs">Service name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. New OP consultation"
            required
          />
        </div>
        <div>
          <label className="label text-xs">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ServiceMasterCategory })}
          >
            <option value="CONSULTATION">Consultation</option>
            <option value="REVIEW">Review</option>
            <option value="OTHER">Other Procedure / Service</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Price (₹) *</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="label text-xs text-emerald-700 font-semibold">Discount amount (₹)</label>
          <input
            className="input border-emerald-300 bg-emerald-50/20 text-emerald-900"
            type="number"
            min={0}
            step="0.01"
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className="md:col-span-4">
          <label className="label text-xs">Description (optional)</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional service notes"
          />
        </div>
        <div className="md:col-span-4 flex justify-end pt-1 border-t">
          <button type="submit" className="btn-primary" disabled={saving || isLoading}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Add Service Master'
            )}
          </button>
        </div>
      </form>

      {/* Edit Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" /> Edit Service Master
              </h2>
              <button onClick={() => setEditingService(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onUpdate} className="space-y-3">
              <div>
                <label className="label text-xs">Service Name *</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs">Category</label>
                  <select
                    className="input"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ServiceMasterCategory })}
                  >
                    <option value="CONSULTATION">Consultation</option>
                    <option value="REVIEW">Review</option>
                    <option value="OTHER">Other Procedure / Service</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Price (₹) *</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs text-emerald-700 font-semibold">Discount (₹)</label>
                  <input
                    className="input border-emerald-300 bg-emerald-50/20 text-emerald-900"
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.discount}
                    onChange={(e) => setEditForm({ ...editForm, discount: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs">Description (optional)</label>
                <input
                  className="input"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-serv-active"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                <label htmlFor="edit-serv-active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (available for OP registration &amp; billing)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="btn-secondary" onClick={() => setEditingService(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Update Service Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Service Master</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong className="text-gray-900">{deletingService.name}</strong>?
              If this service is referenced in past OP registrations or bills, it will be safely deactivated.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" className="btn-secondary" onClick={() => setDeletingService(null)} disabled={isDeleting}>
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
        <div className="px-4 py-3 border-b text-sm font-semibold text-gray-800">Service Catalogue</div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code / Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-emerald-700">Discount amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      {row.code && <p className="font-mono text-xs text-gray-400">{row.code}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{row.category || 'CONSULTATION'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{rupees(row.price)}</td>
                    <td className="px-4 py-3 text-emerald-700 font-medium">
                      {row.discount ? rupees(row.discount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium flex items-center gap-1"
                          onClick={() => startEdit(row)}
                          title="Edit service"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-medium"
                          onClick={() => toggleActive(row)}
                          title={row.isActive ? 'Deactivate service' : 'Activate service'}
                        >
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1"
                          onClick={() => setDeletingService(row)}
                          title="Delete service"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!services.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                      No services yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
