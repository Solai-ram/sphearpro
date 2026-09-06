import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, FileDown } from 'lucide-react';
import { billingApi } from '../../services/billing';
// WhatsApp communication disabled in v1
// import { communicationApi } from '../../services/communication';
import type { Invoice, PaymentMethod } from '../../types/billing';

function rupees(value?: number | string) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const reload = async () => {
    if (!id) return;
    setInvoice(await billingApi.getInvoice(id));
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!invoice) return <div className="p-8 text-gray-500">Invoice not found</div>;

  const outstanding = Number(invoice.outstanding || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/billing" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
          <p className="text-gray-500">{invoice.patient?.name} · {invoice.status.replace('_', ' ')}</p>
        </div>
        <Link to={`/billing/${invoice.id}/print`} className="btn-secondary ml-auto">
          <FileDown className="w-4 h-4 mr-2" /> Preview & print
        </Link>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await billingApi.downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'PDF download failed');
            }
          }}
        >
          Download PDF
        </button>
        {/* WhatsApp communication disabled in v1 */}
      </div>
      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-sm text-gray-500">Total</p><p className="text-xl font-semibold">{rupees(invoice.grandTotal)}</p></div>
        <div className="card p-4"><p className="text-sm text-gray-500">Paid</p><p className="text-xl font-semibold">{rupees(invoice.paidAmount)}</p></div>
        <div className="card p-4"><p className="text-sm text-gray-500">Outstanding</p><p className="text-xl font-semibold">{rupees(invoice.outstanding)}</p></div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warranty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Colour</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(invoice.items || []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-sm">{item.model || '—'}</td>
                <td className="px-4 py-3 text-sm">{item.serialNo || '—'}</td>
                <td className="px-4 py-3 text-sm">{item.warranty || '—'}</td>
                <td className="px-4 py-3 text-sm">{item.colour || '—'}</td>
                <td className="px-4 py-3 text-sm">{item.quantity}</td>
                <td className="px-4 py-3">{rupees(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {outstanding > 0 && invoice.status !== 'CANCELLED' && (
        <form
          className="card p-4 flex gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await billingApi.recordPayment({ invoiceId: invoice.id, amount: Number(amount), method });
              setAmount('');
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Payment failed');
            }
          }}
        >
          <div className="flex-1">
            <label className="label">Record payment</label>
            <input className="input" type="number" min={0.01} step="0.01" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <select className="input w-40" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {['CASH', 'CARD', 'UPI', 'NET_BANKING', 'WALLET', 'OTHER'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <button className="btn-primary" type="submit">Pay</button>
        </form>
      )}

      {(invoice.payments || []).length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Payments</h2>
          {(invoice.payments || []).map((p) => (
            <div key={p.id} className="flex justify-between text-sm py-1 items-center">
              <span>{p.method} · {new Date(p.paidAt).toLocaleString()}</span>
              <span className="flex items-center gap-3">
                {rupees(p.amount)}
                <button
                  className="text-blue-700"
                  type="button"
                  onClick={() => billingApi.downloadReceiptPdf(p.id).catch((err) => setError(err.message))}
                >
                  Receipt
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {['PAID', 'PARTIALLY_PAID'].includes(invoice.status) && (
        <form
          className="card p-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await billingApi.createRefund({ invoiceId: invoice.id, amount: Number(refundAmount), reason: refundReason });
              setRefundAmount('');
              setRefundReason('');
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Refund failed');
            }
          }}
        >
          <h2 className="font-semibold">Refund</h2>
          <input className="input" type="number" min={0.01} step="0.01" placeholder="Amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} required />
          <input className="input" placeholder="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <button className="btn-danger" type="submit">Process refund</button>
        </form>
      )}

      {invoice.status === 'PENDING' && (
        <button
          className="btn-outline"
          onClick={async () => {
            try {
              await billingApi.cancelInvoice(invoice.id);
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Cancel failed');
            }
          }}
        >
          Cancel invoice
        </button>
      )}
    </div>
  );
}
