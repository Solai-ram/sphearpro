import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
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
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const today = toIso(new Date());
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Date range states
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Results & UI states
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table states
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    billingApi
      .revenue(startDate, endDate, 'custom')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load revenue report'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleReset = () => {
    setStartDate(today);
    setEndDate(today);
    setMethodFilter('ALL');
    setSearchQuery('');
    setTableFilter('');
  };

  const handleExportCsv = () => {
    if (!data) return;
    const payments = filteredPayments;
    const headers = ['S.No', 'Date & Time', 'Patient Name', 'Invoice #', 'Payment Mode', 'Amount', 'Status'];
    const rows = payments.map((p: any, idx: number) => [
      idx + 1,
      `"${formatDate(p.paidAt)}"`,
      `"${p.patientName || p.invoice?.patient?.name || ''}"`,
      `"${p.invoiceNumber || p.invoice?.invoiceNumber || ''}"`,
      `"${METHOD_LABEL[p.method] || p.method}"`,
      p.amount ?? 0,
      `"${p.status || 'SUCCESS'}"`,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `REVENUE_REPORT_${startDate}_TO_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    if (!data) return;
    const payments = filteredPayments;
    const headers = ['S.No\tDate & Time\tPatient Name\tInvoice #\tPayment Mode\tAmount'];
    const rows = payments.map((p: any, idx: number) =>
      `${idx + 1}\t${formatDate(p.paidAt)}\t${p.patientName || p.invoice?.patient?.name || ''}\t${p.invoiceNumber || p.invoice?.invoiceNumber || ''}\t${METHOD_LABEL[p.method] || p.method}\t${p.amount ?? 0}`,
    );

    navigator.clipboard.writeText([headers, ...rows].join('\n'));
  };

  const byMethodFiltered = Object.entries(data?.byMethod || {}).filter(([key]) => {
    if (methodFilter === 'ALL') return true;
    return key === methodFilter;
  });

  const rawPayments = data?.payments || [];
  const filteredPayments = useMemo(() => {
    return rawPayments.filter((p: any) => {
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false;
      const q = (searchQuery || tableFilter).toLowerCase().trim();
      if (!q) return true;
      const pName = (p.patientName || p.invoice?.patient?.name || '').toLowerCase();
      const invNum = (p.invoiceNumber || p.invoice?.invoiceNumber || '').toLowerCase();
      const method = (METHOD_LABEL[p.method] || p.method || '').toLowerCase();
      return pName.includes(q) || invNum.includes(q) || method.includes(q);
    });
  }, [rawPayments, methodFilter, searchQuery, tableFilter]);

  const paginatedPayments = useMemo(() => {
    if (pageSize === 9999) return filteredPayments;
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredPayments.length / pageSize) || 1;

  return (
    <div className="space-y-3">
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2980b9] text-white rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-cyan-200" />
          <span className="font-bold text-sm tracking-wide uppercase">REVENUE REPORT</span>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-blue-700/60 text-cyan-100 rounded-full font-medium">
            Real-time Report Builder
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Payment Methods</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="NET_BANKING">Net Banking</option>
                <option value="WALLET">Wallet</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Search Patient / Invoice</label>
              <input
                type="text"
                placeholder="Patient Name or INV-0001..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Total Transactions: {data?.paymentCount || rawPayments.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Hospital Query Bar */}
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
        pageSize={pageSize}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setCurrentPage(1);
        }}
        onExportCsv={handleExportCsv}
        onCopy={handleCopy}
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 border-l-4 border-l-emerald-500 bg-white">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(data?.collected)}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-rose-500 bg-white">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Refunded</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{money(data?.refunded)}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-blue-500 bg-white">
          <p className="text-xs text-gray-500 font-semibold uppercase">Net Revenue</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{money(data?.net)}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500 bg-white">
          <p className="text-xs text-gray-500 font-semibold uppercase">Payments Count</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data?.paymentCount || rawPayments.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Payment Mode Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
              <div className="px-3.5 py-2.5 bg-[#487eb0] text-white font-semibold text-xs flex items-center justify-between">
                <span>COLLECTIONS BY PAYMENT MODE</span>
                <span className="font-mono text-[11px] font-normal opacity-90">
                  {byMethodFiltered.length} modes
                </span>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2 border-r border-gray-200">PAYMENT MODE</th>
                    <th className="px-3.5 py-2 text-right">COLLECTED AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byMethodFiltered.map(([key, val]: [string, any]) => (
                    <tr key={key} className="hover:bg-blue-50/40">
                      <td className="px-3.5 py-2 border-r border-gray-200 font-medium text-gray-800">
                        {METHOD_LABEL[key] || key}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-emerald-700 font-mono">
                        {money(val)}
                      </td>
                    </tr>
                  ))}
                  {byMethodFiltered.length === 0 && (
                    <tr>
                      <td className="px-3.5 py-6 text-center text-gray-400" colSpan={2}>
                        No collections recorded for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* By Service Source Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
              <div className="px-3.5 py-2.5 bg-[#487eb0] text-white font-semibold text-xs flex items-center justify-between">
                <span>REVENUE BY SERVICE SOURCE</span>
                <span className="font-mono text-[11px] font-normal opacity-90">
                  {Object.keys(data?.byBillableType || {}).length} sources
                </span>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2 border-r border-gray-200">SERVICE CATEGORY</th>
                    <th className="px-3.5 py-2 text-right">BILLED AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(data?.byBillableType || {}).map(([key, val]: [string, any]) => (
                    <tr key={key} className="hover:bg-blue-50/40">
                      <td className="px-3.5 py-2 border-r border-gray-200 font-medium text-gray-800">
                        {TYPE_LABEL[key] || key}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-blue-700 font-mono">
                        {money(val)}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(data?.byBillableType || {}).length === 0 && (
                    <tr>
                      <td className="px-3.5 py-6 text-center text-gray-400" colSpan={2}>
                        No services billed for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Table Search */}
          {rawPayments.length > 0 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-gray-500 font-medium">
                Showing {filteredPayments.length} payment transaction(s)
              </span>
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
          )}

          {/* Detailed Payments Register in Hospital Blue */}
          {rawPayments.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#487eb0] text-white font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 whitespace-nowrap border-r border-white/20">
                        <div className="flex items-center gap-1">
                          <span>S.NO</span>
                          <ArrowUpDown className="w-3 h-3 opacity-70" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 whitespace-nowrap border-r border-white/20">
                        <div className="flex items-center gap-1">
                          <span>TRANSACTION DATE</span>
                          <ArrowUpDown className="w-3 h-3 opacity-70" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 whitespace-nowrap border-r border-white/20">PATIENT NAME</th>
                      <th className="px-3 py-2.5 whitespace-nowrap border-r border-white/20">INVOICE NUMBER</th>
                      <th className="px-3 py-2.5 whitespace-nowrap border-r border-white/20">PAYMENT MODE</th>
                      <th className="px-3 py-2.5 whitespace-nowrap text-right">COLLECTED AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          No payment transactions match query filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((p: any, idx: number) => {
                        const sNo = (currentPage - 1) * pageSize + idx + 1;
                        return (
                          <tr key={p.id || idx} className="hover:bg-blue-50/40">
                            <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-200">{sNo}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700 border-r border-gray-200">
                              {formatDate(p.paidAt)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-gray-900 border-r border-gray-200">
                              {p.patientName || p.invoice?.patient?.name || '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-blue-700 border-r border-gray-200">
                              {p.invoiceNumber || p.invoice?.invoiceNumber || '—'}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200">
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {METHOD_LABEL[p.method] || p.method}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700 font-mono">
                              {money(p.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {filteredPayments.length > 0 && (
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
                  <span>
                    Showing {Math.min((currentPage - 1) * pageSize + 1, filteredPayments.length)} to{' '}
                    {Math.min(currentPage * pageSize, filteredPayments.length)} of {filteredPayments.length} payments
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
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                      <button
                        key={i + 1}
                        type="button"
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${
                          currentPage === i + 1
                            ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold'
                            : 'border-gray-300 bg-white hover:bg-gray-100'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
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
          )}
        </div>
      )}
    </div>
  );
}
