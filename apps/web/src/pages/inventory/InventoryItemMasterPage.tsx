import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Product, ProductCategory, Supplier } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COMMON_BRANDS = [
  'Phonak',
  'Signia',
  'Oticon',
  'Widex',
  'ReSound',
  'Starkey',
  'Unitron',
  'Bernafon',
];

const emptyForm = {
  sku: '',
  brand: '',
  name: '', // Model name
  categoryId: '',
  unitPrice: 0,
  taxRate: 0,
  lowStockThreshold: 1,
  initialStock: 0,
  supplierId: '',
  unitCost: 0,
  serialNo: '',
  warranty: '2 years',
  colour: '',
};

function getBrandAndModel(p: Product): { brand: string; model: string } {
  if (p.description && p.description.startsWith('Brand: ')) {
    const brand = p.description.replace('Brand: ', '').trim();
    return { brand: brand || '—', model: p.name };
  }
  if (p.model) {
    const parts = p.model.trim().split(/\s+/);
    const brand = parts[0];
    const model = p.name && p.name !== 'Hearing Aid (A Complete Set)' ? p.name : parts.slice(1).join(' ') || parts[0];
    return { brand, model };
  }
  return { brand: '—', model: p.name };
}

export function InventoryItemMasterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Add category state
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Edit product modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    sku: '',
    brand: '',
    name: '',
    categoryId: '',
    unitPrice: 0,
    taxRate: 0,
    lowStockThreshold: 1,
    serialNo: '',
    warranty: '',
    colour: '',
    isActive: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete product confirmation state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      // Default to first category if form categoryId is empty
      if (!form.categoryId && cats.length > 0) {
        const bte = cats.find((c) => c.name === 'BTE') || cats[0];
        setForm((prev) => ({ ...prev, categoryId: bte.id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item master');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setCatSaving(true);
    setCatError(null);
    try {
      const created = await inventoryApi.createCategory({ name });
      setCategories((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, categoryId: created.id }));
      setNewCatName('');
      setIsAddingCat(false);
      setSaved(`Category "${created.name}" created successfully`);
      setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const brand = form.brand.trim();
      const modelName = form.name.trim();
      const modelFullName = brand ? `${brand} ${modelName}` : modelName;

      const created = await inventoryApi.createProduct({
        sku: form.sku.trim().toUpperCase(),
        name: modelName,
        model: modelFullName,
        description: brand ? `Brand: ${brand}` : undefined,
        categoryId: form.categoryId,
        unitPrice: Number(form.unitPrice || 0),
        taxRate: Number(form.taxRate || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 1),
        initialStock: Number(form.initialStock || 0),
        supplierId: form.supplierId || undefined,
        unitCost: Number(form.unitCost || 0),
        colour: form.colour.trim() || undefined,
        serialNo: form.serialNo.trim() || undefined,
        warranty: form.warranty.trim() || undefined,
      });

      setSaved(`${created.sku} — ${brand ? `${brand} ` : ''}${created.name}`);
      setForm({ ...emptyForm, categoryId: form.categoryId });
      setTimeout(() => setSaved(null), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: Product) => {
    const { brand, model } = getBrandAndModel(p);
    setEditingProduct(p);
    setEditError(null);
    setEditForm({
      sku: p.sku,
      brand: brand !== '—' ? brand : '',
      name: model,
      categoryId: p.categoryId,
      unitPrice: Number(p.unitPrice),
      taxRate: Number(p.taxRate || 0),
      lowStockThreshold: Number(p.lowStockThreshold || 1),
      serialNo: p.serialNo || '',
      warranty: p.warranty || '',
      colour: p.colour || '',
      isActive: p.isActive,
    });
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const brand = editForm.brand.trim();
      const modelName = editForm.name.trim();
      const modelFullName = brand ? `${brand} ${modelName}` : modelName;

      await inventoryApi.updateProduct(editingProduct.id, {
        name: modelName,
        model: modelFullName,
        description: brand ? `Brand: ${brand}` : undefined,
        categoryId: editForm.categoryId,
        unitPrice: Number(editForm.unitPrice || 0),
        taxRate: Number(editForm.taxRate || 0),
        lowStockThreshold: Number(editForm.lowStockThreshold || 1),
        colour: editForm.colour.trim() || undefined,
        serialNo: editForm.serialNo.trim() || undefined,
        warranty: editForm.warranty.trim() || undefined,
        isActive: editForm.isActive,
      });

      setSaved(`Updated ${editForm.sku} — ${brand ? `${brand} ` : ''}${modelName}`);
      setTimeout(() => setSaved(null), 4000);
      setEditingProduct(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      const res = await inventoryApi.deleteProduct(deletingProduct.id);
      setSaved(res.message || `Item ${deletingProduct.sku} deleted.`);
      setTimeout(() => setSaved(null), 4000);
      setDeletingProduct(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Item Master</h1>
          <p className="text-sm text-gray-500">
            Catalog of hearing aids, styles (BTE, RIC, CIC), accessories, and inventory items.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 flex items-center gap-2 text-sm border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saved}</span>
        </div>
      )}

      {/* Item Creation Form */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
          <Plus className="w-4 h-4 text-blue-600" /> Add New Item
        </h2>

        <form onSubmit={onCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* SKU */}
            <div>
              <label className="label">SKU *</label>
              <input
                className="input"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                required
                placeholder="e.g. HA-PHONAK-01"
              />
            </div>

            {/* Brand Name */}
            <div>
              <label className="label">Brand name *</label>
              <input
                className="input"
                list="brand-options"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                required
                placeholder="e.g. Phonak, Signia, Oticon"
              />
              <datalist id="brand-options">
                {COMMON_BRANDS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            {/* Model Name */}
            <div>
              <label className="label">Model name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Audeo Lumity L90"
              />
            </div>

            {/* Category (BTE, RIC, CIC, etc.) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Category *</label>
                <button
                  type="button"
                  onClick={() => setIsAddingCat(!isAddingCat)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isAddingCat ? 'Cancel' : '+ New Category'}
                </button>
              </div>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                required
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inline Add Category Drawer */}
          {isAddingCat && (
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg flex flex-col sm:flex-row gap-2 items-center">
              <span className="text-xs font-semibold text-blue-900 shrink-0">Add Category:</span>
              <input
                className="input flex-1 h-9 bg-white"
                placeholder="Category name (e.g. BTE, RIC, CIC, ITC, Accessory)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button
                type="button"
                disabled={catSaving || !newCatName.trim()}
                onClick={handleAddCategory}
                className="btn-primary h-9 px-4 text-xs shrink-0"
              >
                {catSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Add category
              </button>
              {catError && <p className="text-xs text-red-600 w-full">{catError}</p>}
            </div>
          )}

          {/* Secondary Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="label">Price / unit (₹) *</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="0.00"
                value={form.unitPrice || ''}
                onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Tax (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={form.taxRate || ''}
                onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Low-stock alert</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="1"
                value={form.lowStockThreshold || ''}
                onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Colour</label>
              <input
                className="input"
                placeholder="e.g. Beige, Silver"
                value={form.colour}
                onChange={(e) => setForm({ ...form, colour: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Serial number</label>
              <input
                className="input"
                placeholder="Optional"
                value={form.serialNo}
                onChange={(e) => setForm({ ...form, serialNo: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Warranty</label>
              <input
                className="input"
                placeholder="e.g. 2 years"
                value={form.warranty}
                onChange={(e) => setForm({ ...form, warranty: e.target.value })}
              />
            </div>
          </div>

          {/* Initial Stock & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-gray-100">
            <div>
              <label className="label">Opening stock quantity</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="0"
                value={form.initialStock || ''}
                onChange={(e) => setForm({ ...form, initialStock: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Opening supplier</label>
              <select
                className="input"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              >
                <option value="">Select supplier (optional)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Unit purchase cost (₹)</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.unitCost || ''}
                onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Save item
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by SKU, Brand, or Model name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={() => load()}>
          Search
        </button>
      </div>

      {/* Item Master Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Brand name</th>
                  <th className="px-3 py-2.5 text-left">Model name</th>
                  <th className="px-3 py-2.5 text-left">Category</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Stock</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const { brand, model } = getBrandAndModel(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-800">
                        {p.sku}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {brand !== '—' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {brand}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-gray-900">{model}</p>
                        {p.colour && (
                          <span className="text-xs text-gray-500">Colour: {p.colour}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.category?.name ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              ['BTE', 'RIC', 'CIC'].includes(p.category.name)
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                        {money(p.unitPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`font-semibold ${
                            (p.currentStock ?? 0) <= p.lowStockThreshold
                              ? 'text-amber-600'
                              : 'text-gray-800'
                          }`}
                        >
                          {p.currentStock ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.isLowStock ? (
                          <span className="badge-warning">Low stock</span>
                        ) : p.isActive ? (
                          <span className="badge-success">Active</span>
                        ) : (
                          <span className="badge-gray">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            title="Edit item"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            title="Delete item"
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-gray-500" colSpan={8}>
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="font-medium">No items found.</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Try modifying your search or add a new item above.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" /> Edit Item — {editForm.sku}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onUpdate} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Brand name *</label>
                  <input
                    className="input"
                    list="brand-options-edit"
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    required
                    placeholder="e.g. Phonak, Signia"
                  />
                  <datalist id="brand-options-edit">
                    {COMMON_BRANDS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label">Model name *</label>
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    placeholder="e.g. Audeo Lumity L90"
                  />
                </div>

                <div>
                  <label className="label">Category *</label>
                  <select
                    className="input"
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Price / unit (₹) *</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={editForm.unitPrice}
                    onChange={(e) => setEditForm({ ...editForm, unitPrice: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="label">Tax (%)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.taxRate}
                    onChange={(e) => setEditForm({ ...editForm, taxRate: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="label">Low-stock alert threshold</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={editForm.lowStockThreshold}
                    onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="label">Colour</label>
                  <input
                    className="input"
                    value={editForm.colour}
                    onChange={(e) => setEditForm({ ...editForm, colour: e.target.value })}
                    placeholder="e.g. Beige, Silver"
                  />
                </div>

                <div>
                  <label className="label">Warranty</label>
                  <input
                    className="input"
                    value={editForm.warranty}
                    onChange={(e) => setEditForm({ ...editForm, warranty: e.target.value })}
                    placeholder="e.g. 2 years"
                  />
                </div>

                <div>
                  <label className="label">Serial number</label>
                  <input
                    className="input"
                    value={editForm.serialNo}
                    onChange={(e) => setEditForm({ ...editForm, serialNo: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={editForm.isActive ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="btn-secondary"
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-5 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Delete Item</h3>
                <p className="text-xs text-gray-500">
                  {deletingProduct.sku} · {deletingProduct.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to delete this item? If it already has billing or stock
              transaction history, it will be safely marked inactive to preserve records.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="btn-danger flex items-center gap-1.5"
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
