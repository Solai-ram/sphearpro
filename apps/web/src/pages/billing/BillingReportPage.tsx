import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import { billingApi } from '../../services/billing';
import { DateRangeFilter, periodCaption, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL: Record<string, string> = {
  OP_VISIT: 'Consultation',
  THERAPY_PACKAGE: 'Therapy package',
  THERAPY_SESSION: 'Therapy session',
  PRODUCT: 'Product',
  LAB_TEST: 'Audio',
  OTHER: 'Other',
};

export function BillingReportPage() {
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('daily'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    billingApi.billingReport({ period: range.period, startDate: range.startDate, endDate: range.endDate })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing report'))
      .finally(() => setIsLoading(false));
  }, [range.period, range.startDate, range.endDate]);

  const summary = data?.summary || { invoices: 0, billed: 0, collected: 0, outstanding: 0 };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Billing report</h1>
          <p className="text-sm text-gray-500">Invoices issued {periodCaption(range)}.</p>
        </div>
        <Link to="/reports/billing" className="btn-secondary print:hidden">
          <Printer className="w-4 h-4 mr-2" /> Print preview
        </Link>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3"><p className="text-xs text-gray-500">Invoices</p><p className="text-2xl font-bold">{summary.invoices}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Billed</p><p className="text-2xl font-bold">{money(summary.billed)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Collected</p><p className="text-2xl font-bold">{money(summary.collected)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Outstanding</p><p className="text-2xl font-bold">{money(summary.outstanding)}</p></div>
      </div>
      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By category</div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {Object.entries(data?.byBillableType || {}).map(([key, val]: [string, any]) => (
                    <tr key={key}>
                      <td className="px-3 py-2">{TYPE_LABEL[key] || key}</td>
                      <td className="px-3 py-2 text-right">{val.count} lines</td>
                      <td className="px-3 py-2 text-right font-medium">{money(val.amount)}</td>
                    </tr>
                  ))}
                  {Object.keys(data?.byBillableType || {}).length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No bills in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By status</div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {Object.entries(data?.byStatus || {}).map(([key, val]: [string, any]) => (
                    <tr key={key}>
                      <td className="px-3 py-2">{key.replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-right">{val.count}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(val.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">Invoices</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Billed</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.invoices || []).map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2"><Link className="text-blue-600 font-mono text-xs" to={`/billing/${inv.id}`}>{inv.invoiceNumber}</Link></td>
                    <td className="px-3 py-2">{inv.patient?.name}</td>
                    <td className="px-3 py-2">{inv.status}</td>
                    <td className="px-3 py-2 text-right">{money(inv.grandTotal)}</td>
                    <td className="px-3 py-2 text-right">{money(inv.outstanding)}</td>
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
