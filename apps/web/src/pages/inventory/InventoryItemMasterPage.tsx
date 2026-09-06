import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Package, Search } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Product, ProductCategory, Supplier } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

const emptyForm = {
  sku: '',
  name: '',
  categoryId: '',
  unitPrice: 0,
  taxRate: 0,
  lowStockThreshold: 5,
  initialStock: 0,
  supplierId: '',
  unitCost: 0,
  model: '',
  serialNo: '',
  warranty: '',
  colour: '',
};

export function InventoryItemMasterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async (q = search) => {
    setIsLoading(true);
    try {
      const [prod, cats, sup] = await Promise.all([
        inventoryApi.getProducts({ search: q.trim() || undefined, limit: 100 }),
        inventoryApi.getCategories(),
        inventoryApi.getSuppliers(),
      ]);
      setProducts(prod.data || []);
      setCategories(cats);
      setSuppliers(sup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item master');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const created = await inventoryApi.createProduct({
        ...form,
        supplierId: form.supplierId || undefined,
        initialStock: form.initialStock || undefined,
        unitCost: form.unitCost || undefined,
      });
      setSaved(`${created.sku} — ${created.name}`);
      setForm({ ...emptyForm, categoryId: form.categoryId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Item master</h1>
        <p className="text-sm text-gray-500">Add a product to the catalog, then review the list below.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      {saved && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm">Saved {saved}.</div>}

      <form onSubmit={onCreate} className="card p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="col-span-2 md:col-span-4 flex gap-2">
          <input className="input" placeholder="New category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
          <button type="button" className="btn-secondary shrink-0" onClick={async () => {
            if (!categoryName.trim()) return;
            const created = await inventoryApi.createCategory({ name: categoryName.trim() });
            setCategories([...categories, created]);
            setForm({ ...form, categoryId: created.id });
            setCategoryName('');
          }}>Add category</button>
        </div>
        <div>
          <label className="label">SKU *</label>
          <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required placeholder="HA-001" />
        </div>
        <div className="col-span-2">
          <label className="label">Item name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Hearing aid (complete set)" />
        </div>
        <div>
          <label className="label">Category *</label>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Select</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <input className="input" placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        <input className="input" placeholder="Serial no." value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} />
        <input className="input" placeholder="Warranty" value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} />
        <input className="input" placeholder="Colour" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
        <input className="input" type="number" min={0} step="0.01" placeholder="Price / unit" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} />
        <input className="input" type="number" min={0} step="0.01" placeholder="Tax %" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
        <input className="input" type="number" min={0} placeholder="Low-stock at" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} />
        <input className="input" type="number" min={0} placeholder="Opening stock" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: Number(e.target.value) })} />
        <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">Opening supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" type="number" min={0} step="0.01" placeholder="Unit cost" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save item
          </button>
        </div>
      </form>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search SKU or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={() => load()}>Search</button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{[p.model, p.colour].filter(Boolean).join(' · ') || '—'}</p>
                  </td>
                  <td className="px-3 py-2">{p.category?.name || '—'}</td>
                  <td className="px-3 py-2 text-right">{money(p.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{p.currentStock ?? 0}</td>
                  <td className="px-3 py-2">
                    {p.isLowStock ? <span className="badge-warning">Low stock</span> : p.isActive ? <span className="badge-success">Active</span> : <span className="badge-gray">Inactive</span>}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>
                    <Package className="w-6 h-6 mx-auto mb-1" />No items yet.
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
