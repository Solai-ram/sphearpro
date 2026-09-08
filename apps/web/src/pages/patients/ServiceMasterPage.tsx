import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ListChecks, Loader2 } from 'lucide-react';
import { servicesApi, type ServiceMaster, type ServiceMasterCategory } from '../../services/services';

const CATEGORY_LABEL: Record<ServiceMasterCategory, string> = {
  CONSULTATION: 'Consultation (new OP)',
  REVIEW: 'Review OP',
  OTHER: 'Other',
};

function rupees(value?: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

const emptyForm = {
  code: '',
  name: '',
  category: 'CONSULTATION' as ServiceMasterCategory,
  price: 0,
  description: '',
};

export function ServiceMasterPage() {
  const [categories, setCategories] = useState<ServiceMasterCategory[]>([]);
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [cats, list] = await Promise.all([
        servicesApi.categories(),
        servicesApi.list({ limit: 200 }),
      ]);
      setCategories(cats);
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
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        description: form.description.trim() || undefined,
      });
      setSaved(`${created.code} — ${created.name} (${rupees(created.price)})`);
      setForm({ ...emptyForm, category: form.category });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setSaving(false);
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" /> Service masters
          </h1>
          <p className="text-sm text-gray-500">
            Create priced services used in OP registration and OP review.
          </p>
        </div>
        <Link to="/patients/new?intent=op" className="btn-ghost text-sm">
          New OP
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">Created {saved}</div>
      )}

      <form onSubmit={onSubmit} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Code *</label>
          <input
            className="input"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="e.g. OP-NEW"
            required
          />
        </div>
        <div>
          <label className="label">Service name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. New OP consultation"
            required
          />
        </div>
        <div>
          <label className="label">Category *</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ServiceMasterCategory })}
          >
            {(categories.length ? categories : (['CONSULTATION', 'REVIEW', 'OTHER'] as ServiceMasterCategory[])).map(
              (c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] || c}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="label">Price (₹) *</label>
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
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional note"
          />
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving || isLoading}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Add service'
            )}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">Service catalogue</div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {services.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{CATEGORY_LABEL[row.category] || row.category}</td>
                    <td className="px-3 py-2 font-medium">{rupees(row.price)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn-ghost text-xs" onClick={() => toggleActive(row)}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!services.length && (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>
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
