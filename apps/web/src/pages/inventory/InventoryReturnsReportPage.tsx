import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { DateRangeFilter, periodCaption, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';
import type { StockReturnRequest } from '../../types/inventory';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-red-100 text-red-800',
};

export function InventoryReturnsReportPage() {
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('monthly'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    requests: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    approvedQuantity: 0,
  });
  const [byProduct, setByProduct] = useState<
    { name: string; sku: string; requested: number; approved: number; rejected: number; pending: number }[]
  >([]);
  const [byDay, setByDay] = useState<
    { date: string; requested: number; approved: number; rejected: number; pending: number }[]
  >([]);
  const [requests, setRequests] = useState<StockReturnRequest[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    inventoryApi
      .getReturnsReport({
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
      })
      .then((res) => {
        setSummary(res.summary);
        setByProduct(res.byProduct || []);
        setByDay(res.byDay || []);
        setRequests(res.requests || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load returns report'))
      .finally(() => setLoading(false));
  }, [range.period, range.startDate, range.endDate]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Item return report</h1>
          <p className="text-sm text-gray-500">Return requests {periodCaption(range)}.</p>
        </div>
        <Link to="/reports/returns" className="btn-secondary print:hidden">
          <Printer className="w-4 h-4 mr-2" /> Print preview
        </Link>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500">Requests</p>
          <p className="text-2xl font-bold">{summary.requests}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{summary.pending}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Approved</p>
          <p className="text-2xl font-bold text-emerald-700">{summary.approved}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-700">{summary.rejected}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Units returned</p>
          <p className="text-2xl font-bold">{summary.approvedQuantity}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By product</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byProduct.map((row) => (
                    <tr key={row.sku + row.name}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs font-mono text-gray-500">{row.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700">{row.approved}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{row.pending}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.rejected}</td>
                    </tr>
                  ))}
                  {byProduct.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        No returns in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By day</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Approved</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byDay.map((row) => (
                    <tr key={row.date}>
                      <td className="px-3 py-2">
                        {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-3 py-2 text-right">{row.requested}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{row.approved}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{row.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">Return request lines</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requested by</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reviewed by</th>
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
                    <td className="px-3 py-2">{r.product?.name}</td>
                    <td className="px-3 py-2 text-right">{r.quantity}</td>
                    <td className="px-3 py-2">{r.requester?.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.reviewer?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
