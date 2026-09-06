import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ClipboardList, Loader2, Package, Plus, ShoppingCart, Truck } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import type { Product } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InventoryOverviewPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stock, setStock] = useState<{ items: number; units: number; value: number; lowStock: number } | null>(null);
  const [salesToday, setSalesToday] = useState({ quantity: 0, revenue: 0 });
  const [lowStock, setLowStock] = useState<Product[]>([]);

  useEffect(() => {
    Promise.all([
      inventoryApi.getStockReport(),
      inventoryApi.getSalesReport({ period: 'daily' }),
      inventoryApi.getLowStock(),
    ])
      .then(([stockRes, salesRes, low]) => {
        setStock(stockRes.summary);
        setSalesToday(salesRes.summary);
        setLowStock(low);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inventory'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Inventory</h1>
        <p className="text-sm text-gray-500">Item master, stock, and sales.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'SKUs', value: stock?.items || 0, href: '/inventory/items' },
          { label: 'Units on hand', value: stock?.units || 0, href: '/inventory/stock' },
          { label: 'Stock value', value: money(stock?.value), href: '/inventory/stock' },
          { label: 'Sold today', value: `${salesToday.quantity} · ${money(salesToday.revenue)}`, href: '/inventory/sales' },
        ].map((card) => (
          <Link key={card.label} to={card.href} className="card p-3 hover:border-blue-200">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-lg font-semibold leading-tight">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Link to="/inventory/items" className="btn-primary justify-center"><Plus className="w-4 h-4 mr-1" /> Item master</Link>
        <Link to="/inventory/stock" className="btn-secondary justify-center"><ClipboardList className="w-4 h-4 mr-1" /> Stock report</Link>
        <Link to="/inventory/sales" className="btn-secondary justify-center"><ShoppingCart className="w-4 h-4 mr-1" /> Sales report</Link>
        <Link to="/inventory/movements" className="btn-secondary justify-center"><Package className="w-4 h-4 mr-1" /> Stock entry</Link>
        <Link to="/inventory/suppliers" className="btn-secondary justify-center"><Truck className="w-4 h-4 mr-1" /> Suppliers</Link>
      </div>

      {lowStock.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b text-sm font-semibold text-amber-800 bg-amber-50">
            Low stock ({lowStock.length})
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2 text-right">{p.currentStock ?? 0} on hand</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
