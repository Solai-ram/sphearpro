import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowUpDown,
} from 'lucide-react';
import { billingApi } from '../../services/billing';
import { HospitalReportQueryBar, type ReportDateRange } from '../../components/reports/HospitalReportQueryBar';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val?: string | Date) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BillingReportPage() {
  const today = toIso(new Date());
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Results & UI states
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    billingApi
      .billingReport({ period: 'custom', startDate, endDate })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing report'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleReset = () => {
    setStartDate(today);
    setEndDate(today);
    setInvoiceQuery('');
    setPatientQuery('');
    setStatusFilter('ALL');
    setTableFilter('');
  };

  const handleExportCsv = () => {
    const invoices = filteredInvoices;
    if (invoices.length === 0) return;

    const headers = ['S.No', 'Invoice #', 'Date', 'Patient Name', 'Reg No', 'Status', 'Grand Total', 'Paid', 'Outstanding'];
    const rows = invoices.map((inv: any, idx: number) => [
      idx + 1,
      `"${inv.invoiceNumber || ''}"`,
      `"${formatDate(inv.createdAt)}"`,
      `"${inv.patient?.name || ''}"`,
      `"${inv.patient?.patientNumber || ''}"`,
      `"${inv.status || ''}"`,
      inv.grandTotal ?? 0,
      inv.paidAmount ?? 0,
      inv.outstanding ?? 0,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BILLING_REPORT_${startDate}_TO_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    const invoices = filteredInvoices;
    if (invoices.length === 0) return;

    const headers = ['S.No\tInvoice #\tDate\tPatient Name\tReg No\tStatus\tGrand Total\tPaid\tOutstanding'];
    const rows = invoices.map((inv: any, idx: number) =>
      `${idx + 1}\t${inv.invoiceNumber || ''}\t${formatDate(inv.createdAt)}\t${inv.patient?.name || ''}\t${inv.patient?.patientNumber || ''}\t${inv.status || ''}\t${inv.grandTotal ?? 0}\t${inv.paidAmount ?? 0}\t${inv.outstanding ?? 0}`,
    );

    navigator.clipboard.writeText([headers, ...rows].join('\n'));
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    const list = data?.invoices || [];
    return list.filter((inv: any) => {
      if (invoiceQuery.trim() && !(inv.invoiceNumber || '').toLowerCase().includes(invoiceQuery.toLowerCase().trim())) {
        return false;
      }
      if (patientQuery.trim()) {
        const pName = (inv.patient?.name || '').toLowerCase();
        const pNum = (inv.patient?.patientNumber || '').toLowerCase();
        const q = patientQuery.toLowerCase().trim();
        if (!pName.includes(q) && !pNum.includes(q)) return false;
      }
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
        return false;
      }
      if (tableFilter.trim()) {
        const q = tableFilter.toLowerCase().trim();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const name = (inv.patient?.name || '').toLowerCase();
        const pnum = (inv.patient?.patientNumber || '').toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !pnum.includes(q)) return false;
      }
      return true;
    });
  }, [data, invoiceQuery, patientQuery, statusFilter, tableFilter]);

  // Pagination
  const paginatedInvoices = useMemo(() => {
    if (pageSize === 9999) return filteredInvoices;
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredInvoices.length / pageSize) || 1;
  const summary = data?.summary || { invoices: 0, billed: 0, collected: 0, outstanding: 0 };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#2980b9] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-white" />
          <h1 className="text-base font-bold tracking-wide uppercase">BILLING REPORT</h1>
          <span className="text-xs text-blue-100 font-normal pl-2 border-l border-blue-400">
            Real-time Invoices & Revenue Register
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFilterCollapsed((p) => !p)}
          className="p-1 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
          title={filterCollapsed ? 'Expand Filter Panel' : 'Collapse Filter Panel'}
        >
          {filterCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* 2. Filter Panel (Collapsible) */}
      {!filterCollapsed && (
        <div className="card p-4 space-y-3 bg-white border border-gray-200 rounded-lg shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
              <input
                type="text"
                placeholder="e.g. INV-0001"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono uppercase transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Patient Name / Reg No</label>
              <input
                type="text"
                placeholder="Patient Name or P000001"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Invoice Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">ISSUED</option>
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Matching Invoices: {filteredInvoices.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Hospital Query Bar with Date Range Popover & Export Tools */}
      <HospitalReportQueryBar
        startDate={startDate}
        endDate={endDate}
        onDateChange={({ startDate: s, endDate: e }: ReportDateRange) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onExecute={loadData}
        onReset={handleReset}
        isLoading={isLoading}
        onExportCsv={handleExportCsv}
        onCopy={handleCopy}
        pageSize={pageSize}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setCurrentPage(1);
        }}
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Invoices Issued</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{summary.invoices}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Billed</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{money(summary.billed)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Collected</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{money(summary.collected)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Outstanding Balance</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{money(summary.outstanding)}</p>
        </div>
      </div>

      {/* Quick Search */}
      <div className="flex items-center justify-end text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-medium">Search:</span>
          <input
            type="text"
            placeholder="Quick table filter..."
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-hidden bg-white w-48 shadow-2xs"
          />
        </div>
      </div>

      {/* 4. Invoices Table in Hospital Blue */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap">S.NO</th>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>INVOICE #</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">DATE</th>
                <th className="px-3.5 py-3 whitespace-nowrap">PATIENT</th>
                <th className="px-3.5 py-3 whitespace-nowrap">REG NO</th>
                <th className="px-3.5 py-3 whitespace-nowrap">STATUS</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">BILLED</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">COLLECTED</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">OUTSTANDING</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Loading billing report...
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    No billing records found for the selected query date range.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv: any, idx: number) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={inv.id} className="hover:bg-cyan-50/40 transition-colors">
                      <td className="px-3.5 py-2 font-mono text-gray-500">{rowNumber}</td>
                      <td className="px-3.5 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <Link to={`/billing/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap text-gray-600">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-3.5 py-2 font-bold text-gray-900 whitespace-nowrap">
                        {inv.patient?.name || '—'}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-blue-600 whitespace-nowrap">
                        {inv.patient?.patientNumber || '—'}
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                        {money(inv.grandTotal)}
                      </td>
                      <td className="px-3.5 py-2 text-right font-medium text-emerald-700 whitespace-nowrap">
                        {money((inv.grandTotal || 0) - (inv.outstanding || 0))}
                      </td>
                      <td className="px-3.5 py-2 text-right font-medium text-amber-700 whitespace-nowrap">
                        {money(inv.outstanding)}
                      </td>
                      <td className="px-3.5 py-2 text-right whitespace-nowrap">
                        <Link
                          to={`/billing/${inv.id}`}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          View Bill
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredInvoices.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredInvoices.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length} invoices
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
