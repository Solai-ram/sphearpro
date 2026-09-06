import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { useAuth } from '../../auth/AuthContext';
import type { Product, StockReturnRequest } from '../../types/inventory';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-red-100 text-red-800',
};

export function InventoryReturnRequestsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<StockReturnRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', quantity: 1, reason: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prod, ret] = await Promise.all([
        inventoryApi.getProducts({ limit: 200 }),
        inventoryApi.getReturnRequests(
          statusFilter === 'ALL' ? undefined : { status: statusFilter },
        ),
      ]);
      setProducts(prod.data || []);
      setRequests(ret.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load return requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await inventoryApi.createReturnRequest({
        productId: form.productId,
        quantity: form.quantity,
        reason: form.reason || undefined,
      });
      setForm({ productId: '', quantity: 1, reason: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit return request');
    }
  };

  const review = async (id: string, approved: boolean) => {
    const reviewNote = approved
      ? undefined
      : window.prompt('Rejection reason (optional)') || undefined;
    setBusyId(id);
    setError(null);
    try {
      await inventoryApi.reviewReturnRequest(id, { approved, reviewNote });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Item returns</h1>
        <p className="text-sm text-gray-500">
          Submit a return request — an admin must approve before stock is updated.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          className="input md:col-span-2"
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          required
        >
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name} (stock: {p.currentStock ?? 0})
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          required
        />
        <input
          className="input md:col-span-4"
          placeholder="Reason for return"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <div className="md:col-span-4 flex justify-end">
          <button type="submit" className="btn-primary">
            Submit return request
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-md px-3 py-1 text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {isAdmin && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.requestedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.product?.name}</p>
                    <p className="text-xs font-mono text-gray-500">{r.product?.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-gray-600">{r.reason || '—'}</td>
                  <td className="px-3 py-2">{r.requester?.name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {r.status}
                    </span>
                    {r.reviewNote && (
                      <p className="mt-1 text-xs text-gray-500">{r.reviewNote}</p>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700"
                            disabled={busyId === r.id}
                            onClick={() => void review(r.id, true)}
                          >
                            {busyId === r.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700"
                            disabled={busyId === r.id}
                            onClick={() => void review(r.id, false)}
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {r.reviewer?.name ? `by ${r.reviewer.name}` : '—'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-3 py-8 text-center text-gray-500">
                    No return requests.
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
