import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { billingApi } from '../../services/billing';
import type { Invoice, InvoiceFilters } from '../../types/billing';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  PARTIALLY_PAID: 'badge-info',
  PAID: 'badge-success',
  REFUNDED: 'badge-gray',
  CANCELLED: 'badge-danger',
};

function rupees(value?: number | string) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export function InvoicesListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, limit: 20, search: '', status: '' });
  const [outstanding, setOutstanding] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [result, report] = await Promise.all([billingApi.getInvoices(filters), billingApi.outstanding()]);
        setInvoices(result.data);
        setMeta(result.meta);
        setOutstanding(report.totalOutstanding);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-gray-500">Outstanding: {rupees(outstanding)}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/billing/payments" className="btn-secondary">Payments</Link>
          <Link to="/billing/new" className="btn-primary"><Plus className="w-4 h-4 mr-2" /> New billing</Link>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input className="input pl-10" placeholder="Search invoice # or patient..." value={filters.search || ''} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} />
        </div>
        <select className="input" value={filters.status || ''} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            No invoices yet
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.patient?.name}</td>
                  <td className="px-4 py-3">{rupees(inv.grandTotal)}</td>
                  <td className="px-4 py-3">{rupees(inv.outstanding)}</td>
                  <td className="px-4 py-3"><span className={STATUS_BADGE[inv.status]}>{inv.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3"><Link to={`/billing/${inv.id}`} className="text-blue-600 text-sm font-medium">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex justify-between">
            <span className="text-sm text-gray-600">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={meta.page === 1} onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}><ChevronLeft className="w-4 h-4" /></button>
              <button className="btn-secondary" disabled={meta.page === meta.totalPages} onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
