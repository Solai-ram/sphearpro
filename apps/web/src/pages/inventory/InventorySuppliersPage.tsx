import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Supplier } from '../../types/inventory';

export function InventorySuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  const load = async () => {
    setIsLoading(true);
    try {
      setSuppliers(await inventoryApi.getSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Suppliers</h1>
        <p className="text-sm text-gray-500">Vendors used for opening stock and purchases.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      <form className="card p-3 grid grid-cols-1 md:grid-cols-4 gap-2" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await inventoryApi.createSupplier(form);
          setForm({ name: '', phone: '', email: '' });
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create supplier');
        }
      }}>
        <input className="input" placeholder="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <button className="btn-primary" type="submit">Add supplier</button>
      </form>
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.phone || '—'}</td>
                  <td className="px-3 py-2">{s.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
