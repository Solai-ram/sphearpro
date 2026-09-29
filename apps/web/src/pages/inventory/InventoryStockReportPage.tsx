import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
  ArrowUpDown,
} from 'lucide-react';
import { inventoryApi } from '../../services/inventory';
import { HospitalReportQueryBar } from '../../components/reports/HospitalReportQueryBar';
import type { Product } from '../../types/inventory';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type StockReport = {
  summary: { items: number; active: number; units: number; value: number; lowStock: number };
  byCategory: { category: string; items: number; units: number; value: number; lowStock: number }[];
  items: (Product & { stockValue?: number })[];
};

export function InventoryStockReportPage() {
  const today = toIso(new Date());
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Filter states
  const [data, setData] = useState<StockReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [lowOnly, setLowOnly] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    inventoryApi
      .getStockReport()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stock report'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReset = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setLowOnly(false);
    setTableFilter('');
  };

  const handleExportCsv = () => {
    const items = filteredItems;
    if (items.length === 0) return;

    const headers = ['S.No', 'Item Name', 'SKU', 'Category', 'Unit Price', 'On Hand Qty', 'Stock Value', 'Status'];
    const rows = items.map((p, idx) => [
      idx + 1,
      `"${p.name}"`,
      `"${p.sku}"`,
      `"${p.category?.name || ''}"`,
      p.unitPrice ?? 0,
      p.currentStock ?? 0,
      p.stockValue ?? (Number(p.currentStock || 0) * Number(p.unitPrice || 0)),
      p.isLowStock ? 'LOW STOCK' : 'IN STOCK',
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `STOCK_REPORT_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    const items = filteredItems;
    if (items.length === 0) return;

    const headers = ['S.No\tItem Name\tSKU\tCategory\tOn Hand Qty\tStock Value\tStatus'];
    const rows = items.map((p, idx) =>
      `${idx + 1}\t${p.name}\t${p.sku}\t${p.category?.name || ''}\t${p.currentStock ?? 0}\t${p.stockValue ?? (Number(p.currentStock || 0) * Number(p.unitPrice || 0))}\t${p.isLowStock ? 'LOW' : 'OK'}`,
    );

    navigator.clipboard.writeText([headers, ...rows].join('\n'));
  };

  // Filter items
  const filteredItems = useMemo(() => {
    const list = data?.items || [];
    return list.filter((p) => {
      if (lowOnly && !p.isLowStock) return false;
      if (categoryFilter !== 'ALL' && p.category?.name !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      if (tableFilter.trim()) {
        const q = tableFilter.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchCat = (p.category?.name || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [data, lowOnly, categoryFilter, searchQuery, tableFilter]);

  // Pagination
  const paginatedItems = useMemo(() => {
    if (pageSize === 9999) return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredItems.length / pageSize) || 1;

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    (data?.items || []).forEach((p) => {
      if (p.category?.name) set.add(p.category.name);
    });
    return Array.from(set).sort();
  }, [data]);

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#2980b9] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-white" />
          <h1 className="text-base font-bold tracking-wide uppercase">STOCK REPORT</h1>
          <span className="text-xs text-blue-100 font-normal pl-2 border-l border-blue-400">
            Real-time On-Hand Inventory & Stock Valuation
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Item Name / SKU</label>
              <input
                type="text"
                placeholder="Product Name or SKU"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="pb-1.5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={lowOnly}
                  onChange={(e) => setLowOnly(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span>Low stock items only</span>
              </label>
            </div>

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Products: {filteredItems.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Hospital Query Bar */}
      <HospitalReportQueryBar
        startDate={today}
        endDate={today}
        onDateChange={() => undefined}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Products</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{data?.summary.items || 0}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Units on Hand</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{data?.summary.units || 0}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Stock Value</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{money(data?.summary.value)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Low Stock Alerts</p>
          <p className="text-xl font-bold text-rose-700 mt-1">{data?.summary.lowStock || 0}</p>
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

      {/* 4. Stock Table in Hospital Blue */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">
                  <div className="flex items-center gap-1">
                    <span>ITEM NAME</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">SKU / CODE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">CATEGORY</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap border-r border-white/20">UNIT PRICE</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap border-r border-white/20">ON HAND</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap border-r border-white/20">STOCK VALUE</th>
                <th className="px-2.5 py-2 text-center whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Loading stock records...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No items match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((p, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const itemValue = p.stockValue ?? (Number(p.currentStock || 0) * Number(p.unitPrice || 0));

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{rowNumber}</td>
                      <td className="px-2.5 py-1.5 font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">
                        <Link to={`/inventory/items`} className="hover:text-blue-600 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-blue-700 whitespace-nowrap border-r border-gray-200">
                        {p.sku}
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600 border-r border-gray-200">
                        {p.category?.name || '—'}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-medium text-gray-700 font-mono border-r border-gray-200">
                        {money(p.unitPrice)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-gray-900 whitespace-nowrap border-r border-gray-200">
                        {p.currentStock ?? 0}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-emerald-700 font-mono whitespace-nowrap border-r border-gray-200">
                        {money(itemValue)}
                      </td>
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.isLowStock
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.isLowStock ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredItems.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} products
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
