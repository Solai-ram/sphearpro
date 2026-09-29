import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw as UndoIcon,
  ArrowUpDown,
} from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { HospitalReportQueryBar, type ReportDateRange } from '../../components/reports/HospitalReportQueryBar';
import type { StockReturnRequest } from '../../types/inventory';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900 border border-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 border border-red-300',
};

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

export function InventoryReturnsReportPage() {
  const today = toIso(new Date());
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productQuery, setProductQuery] = useState('');
  const [requesterQuery, setRequesterQuery] = useState('');

  // Results & UI states
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

  // Table pagination and quick filter
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<HTMLTableElement>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    inventoryApi
      .getReturnsReport({
        period: 'custom',
        startDate,
        endDate,
      })
      .then((res) => {
        setSummary(res.summary);
        setByProduct(res.byProduct || []);
        setByDay(res.byDay || []);
        setRequests(res.requests || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load returns report'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleReset = () => {
    setStartDate(today);
    setEndDate(today);
    setStatusFilter('ALL');
    setProductQuery('');
    setRequesterQuery('');
    setTableFilter('');
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (productQuery.trim()) {
        const q = productQuery.toLowerCase();
        const pName = r.product?.name?.toLowerCase() || '';
        const pSku = r.product?.sku?.toLowerCase() || '';
        if (!pName.includes(q) && !pSku.includes(q)) return false;
      }
      if (requesterQuery.trim()) {
        const q = requesterQuery.toLowerCase();
        const rName = r.requester?.name?.toLowerCase() || '';
        if (!rName.includes(q)) return false;
      }
      if (tableFilter.trim()) {
        const q = tableFilter.toLowerCase();
        const pName = r.product?.name?.toLowerCase() || '';
        const pSku = r.product?.sku?.toLowerCase() || '';
        const rName = r.requester?.name?.toLowerCase() || '';
        const reason = r.reason?.toLowerCase() || '';
        const status = r.status.toLowerCase();
        if (!pName.includes(q) && !pSku.includes(q) && !rName.includes(q) && !reason.includes(q) && !status.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, productQuery, requesterQuery, tableFilter]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;

  const handleExportCsv = () => {
    if (filteredRequests.length === 0) return;
    const headers = ['S.No', 'Date', 'Product', 'SKU', 'Quantity', 'Status', 'Requested By', 'Reason', 'Reviewed By', 'Review Note'];
    const rows = filteredRequests.map((r, idx) => [
      idx + 1,
      `"${formatDate(r.requestedAt)}"`,
      `"${r.product?.name || ''}"`,
      `"${r.product?.sku || ''}"`,
      r.quantity,
      `"${r.status}"`,
      `"${r.requester?.name || ''}"`,
      `"${r.reason || ''}"`,
      `"${r.reviewer?.name || ''}"`,
      `"${r.reviewNote || ''}"`,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ITEM_RETURNS_REPORT_${startDate}_TO_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!tableRef.current) return;
    const range = document.createRange();
    range.selectNode(tableRef.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    try {
      document.execCommand('copy');
      window.getSelection()?.removeAllRanges();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2980b9] text-white rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <UndoIcon className="w-5 h-5 text-cyan-200" />
          <span className="font-bold text-sm tracking-wide uppercase">ITEM RETURNS REPORT</span>
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
              <label className="block text-xs text-gray-500 mb-1">Return Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name / SKU</label>
              <input
                type="text"
                placeholder="Search product..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Requested By</label>
              <input
                type="text"
                placeholder="Requester staff name..."
                value={requesterQuery}
                onChange={(e) => setRequesterQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Query Bar */}
      <HospitalReportQueryBar
        startDate={startDate}
        endDate={endDate}
        onDateChange={({ startDate: s, endDate: e }: ReportDateRange) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onExecute={loadData}
        onReset={handleReset}
        isLoading={loading}
        pageSize={pageSize}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setCurrentPage(1);
        }}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
        onCopy={handleCopy}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm border border-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card p-3 border-l-4 border-l-blue-500">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.requests}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-amber-500">
          <p className="text-xs text-amber-700 font-semibold uppercase">Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.pending}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-emerald-700 font-semibold uppercase">Approved</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.approved}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-red-500">
          <p className="text-xs text-red-700 font-semibold uppercase">Rejected</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{summary.rejected}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-xs text-purple-700 font-semibold uppercase">Units Returned</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{summary.approvedQuantity}</p>
        </div>
      </div>

      {/* Summary Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-3 py-2 bg-gray-50 border-b text-xs font-bold text-gray-700 uppercase">
            Returns by Product
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Approved</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                  <th className="px-3 py-2 text-right">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byProduct.map((row) => (
                  <tr key={row.sku + row.name} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-[10px] font-mono text-gray-500">{row.sku}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right text-emerald-700 font-semibold">{row.approved}</td>
                    <td className="px-3 py-1.5 text-right text-amber-700 font-semibold">{row.pending}</td>
                    <td className="px-3 py-1.5 text-right text-red-700 font-semibold">{row.rejected}</td>
                  </tr>
                ))}
                {byProduct.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                      No returns in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-3 py-2 bg-gray-50 border-b text-xs font-bold text-gray-700 uppercase">
            Returns by Day
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Approved</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byDay.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-800 font-medium">
                      {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-gray-900">{row.requested}</td>
                    <td className="px-3 py-1.5 text-right text-emerald-700 font-semibold">{row.approved}</td>
                    <td className="px-3 py-1.5 text-right text-amber-700 font-semibold">{row.pending}</td>
                  </tr>
                ))}
                {byDay.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                      No records by day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Table Search */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-gray-500 font-medium">
          Showing {filteredRequests.length} return request(s)
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

      {/* 4. Hospital Blue Records Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>S.NO</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>WHEN</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>PRODUCT</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">SKU</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">QTY</th>
                <th className="px-3 py-2.5 whitespace-nowrap">REQUESTED BY</th>
                <th className="px-3 py-2.5 whitespace-nowrap">REASON</th>
                <th className="px-3 py-2.5 whitespace-nowrap">STATUS</th>
                <th className="px-3 py-2.5 whitespace-nowrap">REVIEWED BY</th>
                <th className="px-3 py-2.5 whitespace-nowrap">REVIEW NOTE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Generating Item Returns report...
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    No item return requests found for the selected query date range ({startDate} to {endDate}).
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r, idx) => {
                  const sNo = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-gray-500">{sNo}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                        {formatDate(r.requestedAt)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">
                        {r.product?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600">
                        {r.product?.sku || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                        {r.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-gray-800 font-medium">
                        {r.requester?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate" title={r.reason || ''}>
                        {r.reason || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_CLASS[r.status] || 'bg-gray-100 text-gray-800'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {r.reviewer?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate" title={r.reviewNote || ''}>
                        {r.reviewNote || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRequests.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(currentPage * pageSize, filteredRequests.length)}
              </span>{' '}
              of <span className="font-semibold">{filteredRequests.length}</span> entries
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold'
                        : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
