import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Product } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type StockReport = {
  summary: { items: number; active: number; units: number; value: number; lowStock: number };
  byCategory: { category: string; items: number; units: number; value: number; lowStock: number }[];
  items: (Product & { stockValue?: number })[];
};

export function InventoryStockReportPage() {
  const [data, setData] = useState<StockReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    inventoryApi.getStockReport()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stock report'))
      .finally(() => setIsLoading(false));
  }, []);

  const rows = (data?.items || []).filter((p) => (lowOnly ? p.isLowStock : true));

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Stock report</h1>
          <p className="text-sm text-gray-500">On-hand quantity and stock value by item.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports/stock" className="btn-secondary print:hidden">
            <Printer className="w-4 h-4 mr-2" /> Print preview
          </Link>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Low stock only
          </label>
        </div>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Items', value: data?.summary.items || 0 },
          { label: 'Units on hand', value: data?.summary.units || 0 },
          { label: 'Stock value', value: money(data?.summary.value) },
          { label: 'Low stock', value: data?.summary.lowStock || 0 },
        ].map((card) => (
          <div key={card.label} className="card p-3">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">By category</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Units</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Low</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.byCategory || []).map((row) => (
              <tr key={row.category}>
                <td className="px-3 py-2">{row.category}</td>
                <td className="px-3 py-2 text-right">{row.items}</td>
                <td className="px-3 py-2 text-right">{row.units}</td>
                <td className="px-3 py-2 text-right">{money(row.value)}</td>
                <td className="px-3 py-2 text-right">{row.lowStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">Item-wise stock</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">On hand</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr key={p.id} className={p.isLowStock ? 'bg-amber-50' : ''}>
                <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.category?.name || '—'}</td>
                <td className="px-3 py-2 text-right">{p.currentStock ?? 0}</td>
                <td className="px-3 py-2 text-right">{money(p.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{money(p.stockValue)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={6}>No stock rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
