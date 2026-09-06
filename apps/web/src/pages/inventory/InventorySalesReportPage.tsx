import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { DateRangeFilter, periodCaption, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';
import type { ProductSale } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InventorySalesReportPage() {
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('daily'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ sales: 0, quantity: 0, revenue: 0 });
  const [byProduct, setByProduct] = useState<{ name: string; sku: string; quantity: number; revenue: number }[]>([]);
  const [byDay, setByDay] = useState<{ date: string; quantity: number; revenue: number; sales: number }[]>([]);
  const [sales, setSales] = useState<ProductSale[]>([]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    inventoryApi.getSalesReport({
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    })
      .then((res) => {
        setSummary(res.summary);
        setByProduct(res.byProduct || []);
        setByDay(res.byDay || []);
        setSales(res.sales || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sales report'))
      .finally(() => setIsLoading(false));
  }, [range.period, range.startDate, range.endDate]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Sales report</h1>
          <p className="text-sm text-gray-500">Product sales {periodCaption(range)}.</p>
        </div>
        <Link to="/reports/sales" className="btn-secondary print:hidden">
          <Printer className="w-4 h-4 mr-2" /> Print preview
        </Link>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-3"><p className="text-xs text-gray-500">Bills</p><p className="text-2xl font-bold">{summary.sales}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Units sold</p><p className="text-2xl font-bold">{summary.quantity}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Revenue</p><p className="text-2xl font-bold">{money(summary.revenue)}</p></div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By product</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byProduct.map((row) => (
                    <tr key={row.sku + row.name}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs font-mono text-gray-500">{row.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{row.quantity}</td>
                      <td className="px-3 py-2 text-right">{money(row.revenue)}</td>
                    </tr>
                  ))}
                  {byProduct.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No sales in this period.</td></tr>
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
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Bills</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byDay.map((row) => (
                    <tr key={row.date}>
                      <td className="px-3 py-2">{new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-3 py-2 text-right">{row.sales}</td>
                      <td className="px-3 py-2 text-right">{row.quantity}</td>
                      <td className="px-3 py-2 text-right">{money(row.revenue)}</td>
                    </tr>
                  ))}
                  {byDay.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No daily totals.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">Sale lines</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(s.soldAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2">{s.patient?.name}</td>
                    <td className="px-3 py-2">{s.product?.name}</td>
                    <td className="px-3 py-2 text-right">{s.quantity}</td>
                    <td className="px-3 py-2 text-right">{money(s.totalPrice)}</td>
                    <td className="px-3 py-2">{s.invoiceId ? <Link className="text-blue-600" to={`/billing/${s.invoiceId}`}>View</Link> : '—'}</td>
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
