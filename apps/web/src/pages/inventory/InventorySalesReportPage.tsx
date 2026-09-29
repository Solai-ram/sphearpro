import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  ArrowUpDown,
} from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { HospitalReportQueryBar, type ReportDateRange } from '../../components/reports/HospitalReportQueryBar';
import type { ProductSale } from '../../types/inventory';

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

export function InventorySalesReportPage() {
  const today = toIso(new Date());
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [productQuery, setProductQuery] = useState('');
  const [patientQuery, setPatientQuery] = useState('');

  // Results & UI states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ sales: 0, quantity: 0, revenue: 0 });
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    inventoryApi
      .getSalesReport({
        period: 'custom',
        startDate,
        endDate,
      })
      .then((res) => {
        setSummary(res.summary);
        setSales(res.sales || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sales report'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleReset = () => {
    setStartDate(today);
    setEndDate(today);
    setProductQuery('');
    setPatientQuery('');
    setTableFilter('');
  };

  // Export CSV
  const handleExportCsv = () => {
    const list = filteredSales;
    if (list.length === 0) return;

    const headers = ['S.No', 'Date', 'Product', 'SKU', 'Patient Name', 'Quantity', 'Unit Price', 'Total Price'];
    const rows = list.map((s: any, idx) => [
      idx + 1,
      `"${formatDate(s.soldAt)}"`,
      `"${s.product?.name || ''}"`,
      `"${s.product?.sku || ''}"`,
      `"${s.patient?.name || ''}"`,
      s.quantity,
      s.unitPrice ?? 0,
      s.totalPrice ?? 0,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SALES_REPORT_${startDate}_TO_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy table
  const handleCopy = () => {
    const list = filteredSales;
    if (list.length === 0) return;

    const headers = ['S.No\tDate\tProduct\tSKU\tPatient Name\tQuantity\tMRP\tTotal Price'];
    const rows = list.map((s: any, idx) =>
      `${idx + 1}\t${formatDate(s.soldAt)}\t${s.product?.name || ''}\t${s.product?.sku || ''}\t${s.patient?.name || ''}\t${s.quantity}\t${s.unitPrice ?? 0}\t${s.totalPrice ?? 0}`,
    );

    navigator.clipboard.writeText([headers, ...rows].join('\n'));
  };

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      if (productQuery.trim()) {
        const pName = (s.product?.name || '').toLowerCase();
        const pSku = (s.product?.sku || '').toLowerCase();
        const q = productQuery.toLowerCase().trim();
        if (!pName.includes(q) && !pSku.includes(q)) return false;
      }
      if (patientQuery.trim()) {
        const ptName = (s.patient?.name || '').toLowerCase();
        const ptNum = (s.patient?.patientNumber || '').toLowerCase();
        const q = patientQuery.toLowerCase().trim();
        if (!ptName.includes(q) && !ptNum.includes(q)) return false;
      }
      if (tableFilter.trim()) {
        const q = tableFilter.toLowerCase().trim();
        const pName = (s.product?.name || '').toLowerCase();
        const pSku = (s.product?.sku || '').toLowerCase();
        const ptName = (s.patient?.name || '').toLowerCase();
        if (!pName.includes(q) && !pSku.includes(q) && !ptName.includes(q)) return false;
      }
      return true;
    });
  }, [sales, productQuery, patientQuery, tableFilter]);

  // Pagination
  const paginatedSales = useMemo(() => {
    if (pageSize === 9999) return filteredSales;
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredSales.length / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#2980b9] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-white" />
          <h1 className="text-base font-bold tracking-wide uppercase">SALES REPORT</h1>
          <span className="text-xs text-blue-100 font-normal pl-2 border-l border-blue-400">
            Real-time Product Sales & Dispensing Register
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name / SKU</label>
              <input
                type="text"
                placeholder="Product Name or SKU"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Patient Name / Reg No</label>
              <input
                type="text"
                placeholder="Customer or Patient"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Sales Transactions: {filteredSales.length}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Bills Count</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{summary.sales}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Units Sold</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{summary.quantity}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Sales Revenue</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{money(summary.revenue)}</p>
        </div>
      </div>

      {/* Quick In-table Search */}
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

      {/* 4. Sales Records Table in Hospital Blue */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">
                  <div className="flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PRODUCT NAME</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">SKU / CODE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PATIENT</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap border-r border-white/20">QTY</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap border-r border-white/20">MRP PER UNIT</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap">TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Loading sales records...
                  </td>
                </tr>
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No sales recorded for the selected query date range.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s: any, idx: number) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={s.id || idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{rowNumber}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600 border-r border-gray-200">
                        {formatDate(s.soldAt)}
                      </td>
                      <td className="px-2.5 py-1.5 font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">
                        {s.product?.name || '—'}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-blue-700 whitespace-nowrap border-r border-gray-200">
                        {s.product?.sku || '—'}
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap border-r border-gray-200">
                        {s.patient ? (
                          <Link to={`/patients/${s.patient.id}`} className="font-semibold text-blue-600 hover:underline">
                            {s.patient.name}
                          </Link>
                        ) : (
                          <span className="text-gray-500">Direct OTC Sale</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold text-gray-800 border-r border-gray-200">
                        {s.quantity}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-medium text-gray-700 font-mono border-r border-gray-200">
                        {money(s.unitPrice)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-emerald-700 font-mono">
                        {money(s.totalPrice)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredSales.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredSales.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredSales.length)} of {filteredSales.length} sales
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
