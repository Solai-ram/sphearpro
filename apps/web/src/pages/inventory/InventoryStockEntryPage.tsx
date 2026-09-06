import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Product, StockTransaction, StockTxnType, Supplier } from '../../types/inventory';

const STOCK_TYPES: Exclude<StockTxnType, 'SALE' | 'RETURN'>[] = ['PURCHASE', 'DAMAGE', 'ADJUSTMENT'];

export function InventoryStockEntryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    productId: '',
    type: 'PURCHASE' as Exclude<StockTxnType, 'SALE' | 'RETURN'>,
    quantity: 1,
    supplierId: '',
    unitCost: 0,
    note: '',
  });

  const load = async () => {
    setIsLoading(true);
    try {
      const [prod, sup, tx] = await Promise.all([
        inventoryApi.getProducts({ limit: 100 }),
        inventoryApi.getSuppliers(),
        inventoryApi.getStockTransactions(),
      ]);
      setProducts(prod.data || []);
      setSuppliers(sup);
      setTransactions(tx.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock movements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.recordStock({
        ...form,
        supplierId: form.supplierId || undefined,
        unitCost: form.unitCost || undefined,
        note: form.note || undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record stock');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Stock entry</h1>
        <p className="text-sm text-gray-500">Purchase, damage, or adjustment. Item returns use the Returns page.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      <form onSubmit={onSubmit} className="card p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
          <option value="">Product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Exclude<StockTxnType, 'SALE' | 'RETURN'> })}>
          {STOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required />
        <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">Supplier (optional)</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" type="number" min={0} step="0.01" placeholder="Unit cost" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
        <input className="input" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <div className="col-span-2 md:col-span-3 flex justify-end">
          <button className="btn-primary" type="submit">Record movement</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2">{t.product?.name}</td>
                  <td className="px-3 py-2">{t.type}</td>
                  <td className="px-3 py-2 text-right">{t.quantity}</td>
                  <td className="px-3 py-2 text-right">{t.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
