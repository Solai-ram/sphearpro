import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from 'lucide-react';
import { billingApi } from '../../services/billing';
import { HospitalReportQueryBar, type ReportDateRange } from '../../components/reports/HospitalReportQueryBar';

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Results & UI states
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);

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
  };

  const handleExportCsv = () => {
    if (!data) return;

    const headers = ['Category', 'Type', 'Amount'];
    const rows: string[] = [];

    // By Method
    Object.entries(data.byMethod || {}).forEach(([m, amt]) => {
      rows.push(`"Payment Mode","${METHOD_LABEL[m] || m}",${amt}`);
    });

    // By Source
    Object.entries(data.byBillableType || {}).forEach(([s, amt]) => {
      rows.push(`"Service Source","${TYPE_LABEL[s] || s}",${amt}`);
    });

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
    const lines = ['Category\tType\tAmount'];
    Object.entries(data.byMethod || {}).forEach(([m, amt]) => {
      lines.push(`Payment Mode\t${METHOD_LABEL[m] || m}\t${amt}`);
    });
    Object.entries(data.byBillableType || {}).forEach(([s, amt]) => {
      lines.push(`Service Source\t${TYPE_LABEL[s] || s}\t${amt}`);
    });
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const byMethodFiltered = Object.entries(data?.byMethod || {}).filter(([k]) => {
    if (methodFilter !== 'ALL' && k !== methodFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#2980b9] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-white" />
          <h1 className="text-base font-bold tracking-wide uppercase">REVENUE REPORT</h1>
          <span className="text-xs text-blue-100 font-normal pl-2 border-l border-blue-400">
            Real-time Collections & Payments Register
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

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Total Payment Transactions: {data?.paymentCount || 0}
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
          <p className="text-xs text-gray-500 font-medium">Total Collected</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{money(data?.collected)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Total Refunded</p>
          <p className="text-xl font-bold text-rose-700 mt-1">{money(data?.refunded)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Net Revenue</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{money(data?.net)}</p>
        </div>
        <div className="card p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Payments Count</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{data?.paymentCount || 0}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        </div>
      ) : (
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
                  <th className="px-3.5 py-2">PAYMENT MODE</th>
                  <th className="px-3.5 py-2 text-right">COLLECTED AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byMethodFiltered.map(([key, val]: [string, any]) => (
                  <tr key={key} className="hover:bg-cyan-50/40">
                    <td className="px-3.5 py-2.5 font-medium text-gray-800">
                      {METHOD_LABEL[key] || key}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 font-mono">
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
                  <th className="px-3.5 py-2">SERVICE CATEGORY</th>
                  <th className="px-3.5 py-2 text-right">BILLED AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(data?.byBillableType || {}).map(([key, val]: [string, any]) => (
                  <tr key={key} className="hover:bg-cyan-50/40">
                    <td className="px-3.5 py-2.5 font-medium text-gray-800">
                      {TYPE_LABEL[key] || key}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-blue-700 font-mono">
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
      )}
    </div>
  );
}
