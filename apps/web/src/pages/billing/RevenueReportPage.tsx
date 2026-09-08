import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import { billingApi } from '../../services/billing';
import { DateRangeFilter, periodCaption, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net banking',
  WALLET: 'Wallet',
  OTHER: 'Other',
};

const TYPE_LABEL: Record<string, string> = {
  OP_VISIT: 'Consultation',
  LAB_TEST: 'Audio',
  PRODUCT: 'Product',
  THERAPY_PACKAGE: 'Therapy package',
  THERAPY_SESSION: 'Therapy session',
  OTHER: 'Other',
};

export function RevenueReportPage() {
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('daily'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    billingApi.revenue(range.startDate, range.endDate, range.period)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load revenue report'))
      .finally(() => setIsLoading(false));
  }, [range.period, range.startDate, range.endDate]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Revenue report</h1>
          <p className="text-sm text-gray-500">Collections {periodCaption(range)} by payment mode.</p>
        </div>
        <Link to="/reports/revenue" className="btn-secondary print:hidden">
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
        <div className="card p-3"><p className="text-xs text-gray-500">Collected</p><p className="text-2xl font-bold">{money(data?.collected)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Refunded</p><p className="text-2xl font-bold">{money(data?.refunded)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Net</p><p className="text-2xl font-bold">{money(data?.net)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Payments</p><p className="text-2xl font-bold">{data?.paymentCount || 0}</p></div>
      </div>
      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By payment mode</div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'WALLET', 'OTHER'].filter((k) => data?.byMethod?.[k]).concat(
                    Object.keys(data?.byMethod || {}).filter((k) => !['CASH', 'UPI', 'CARD', 'NET_BANKING', 'WALLET', 'OTHER'].includes(k)),
                  ).map((key) => (
                    <tr key={key}>
                      <td className="px-3 py-2">{METHOD_LABEL[key] || key}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(data.byMethod[key])}</td>
                    </tr>
                  ))}
                  {Object.keys(data?.byMethod || {}).length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={2}>No collections in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-semibold">By source</div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {['OP_VISIT', 'LAB_TEST', 'PRODUCT', 'THERAPY_PACKAGE', 'THERAPY_SESSION', 'OTHER']
                    .filter((k) => data?.byBillableType?.[k])
                    .concat(Object.keys(data?.byBillableType || {}).filter((k) => !['OP_VISIT', 'LAB_TEST', 'PRODUCT', 'THERAPY_PACKAGE', 'THERAPY_SESSION', 'OTHER'].includes(k)))
                    .map((key) => (
                    <tr key={key}>
                      <td className="px-3 py-2">{TYPE_LABEL[key] || key}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(data.byBillableType[key])}</td>
                    </tr>
                  ))}
                  {Object.keys(data?.byBillableType || {}).length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={2}>No collections in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">By day</div>
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pays</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.byDay || []).map((row: { date: string; collected: number; count: number }) => (
                    <tr key={row.date}>
                      <td className="px-3 py-2">{new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right">{money(row.collected)}</td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">Payments</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.payments || []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(p.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2">{p.patientName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.invoiceNumber}</td>
                    <td className="px-3 py-2">{METHOD_LABEL[p.method] || p.method}</td>
                    <td className="px-3 py-2 text-right">{money(p.amount)}</td>
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
