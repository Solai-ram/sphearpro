import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { billingApi } from '../../services/billing';
import type { Payment } from '../../types/billing';

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<{ collected: number; refunded: number; net: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [list, report] = await Promise.all([billingApi.getPayments({ page: 1 }), billingApi.revenue()]);
        setPayments(list.data);
        setRevenue(report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payments');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/billing" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-2xl font-bold">Payments</h1>
      </div>
      {revenue && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-sm text-gray-500">Collected</p><p className="text-xl font-semibold">₹{revenue.collected.toFixed(2)}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Refunded</p><p className="text-xl font-semibold">₹{revenue.refunded.toFixed(2)}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Net</p><p className="text-xl font-semibold">₹{revenue.net.toFixed(2)}</p></div>
        </div>
      )}
      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm">{new Date(p.paidAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.patient?.name}</td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {p.invoice ? <Link className="text-blue-600" to={`/billing/${p.invoice.id}`}>{p.invoice.invoiceNumber}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{p.method}</td>
                  <td className="px-4 py-3">₹{Number(p.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-700 text-sm" onClick={() => billingApi.downloadReceiptPdf(p.id).catch((err) => setError(err.message))}>
                      Receipt PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
