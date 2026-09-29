import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  BarChart2,
  Stethoscope,
  Activity,
  Headphones,
  Bot,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';
import { HospitalReportQueryBar, type ReportDateRange } from '../../components/reports/HospitalReportQueryBar';
import { reportsApi } from '../../services/dashboard';
import { billingApi } from '../../services/billing';
import { inventoryApi } from '../../services/inventory';
import { clinicalApi } from '../../services/clinical';
import { labApi } from '../../services/lab';
import { therapyApi } from '../../services/therapy';
import { appointmentsApi } from '../../services/appointments';
import type { OpCase } from '../../types/clinical';
import type { LabDashboard, LabProcedure } from '../../types/lab';
import type { TherapyCase } from '../../types/therapy';
import { ageFromDob } from '../../lib/age';

type ReportId = 'clinical' | 'op' | 'therapy' | 'lab' | 'billing' | 'revenue' | 'stock' | 'sales' | 'returns' | 'ai';

const REPORTS: {
  id: ReportId;
  name: string;
  hint: string;
  ranged: boolean;
  csv?: 'clinical' | 'op' | 'therapy' | 'financial' | 'inventory' | 'ai';
  path: string;
}[] = [
  { id: 'clinical', name: 'OP clinical', hint: 'OP cases registered and diagnosis distribution', ranged: true, csv: 'clinical', path: '/reports/clinical' },
  { id: 'op', name: 'OP visits', hint: 'Visit register for the selected period', ranged: true, csv: 'op', path: '/reports/op' },
  { id: 'therapy', name: 'Therapy', hint: 'Cases, sessions, attendance and package use', ranged: true, csv: 'therapy', path: '/reports/therapy' },
  { id: 'lab', name: 'Audio', hint: 'Tests billed and procedure catalogue', ranged: false, path: '/reports/lab' },
  { id: 'billing', name: 'Billing', hint: 'Invoices issued, billed vs collected', ranged: true, path: '/reports/billing' },
  { id: 'revenue', name: 'Revenue', hint: 'Collections by payment mode and source', ranged: true, csv: 'financial', path: '/reports/revenue' },
  { id: 'stock', name: 'Stock', hint: 'On-hand quantity, value and low stock', ranged: false, csv: 'inventory', path: '/reports/stock' },
  { id: 'sales', name: 'Sales', hint: 'Product sales by item and day', ranged: true, path: '/reports/sales' },
  { id: 'returns', name: 'Item returns', hint: 'Return requests by status and product', ranged: true, path: '/reports/returns' },
  { id: 'ai', name: 'AI usage', hint: 'Requests and tokens by provider', ranged: true, csv: 'ai', path: '/reports/ai' },
];

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val?: string | Date) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(val?: string | Date) {
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

export function ReportsPage() {
  const { type } = useParams<{ type?: string }>();
  if (!type) return <ReportsIndex />;

  // Redirect to dedicated pages if accessed here
  if (type === 'op') return <Navigate to="/reports/op" replace />;
  if (type === 'billing') return <Navigate to="/reports/billing" replace />;
  if (type === 'revenue') return <Navigate to="/reports/revenue" replace />;
  if (type === 'stock') return <Navigate to="/reports/stock" replace />;
  if (type === 'sales') return <Navigate to="/reports/sales" replace />;
  if (type === 'returns') return <Navigate to="/reports/returns" replace />;

  if (!REPORTS.some((r) => r.id === type)) return <Navigate to="/reports" replace />;
  return <ReportViewer id={type as ReportId} />;
}

function ReportsIndex() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Hospital Reports</h1>
        <p className="page-subtitle">Real-time reports register and builder with custom query filters, print, and CSV exports.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((report) => (
          <Link key={report.id} to={report.path} className="card p-4 hover:border-blue-400 hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#2980b9]/10 text-[#2980b9] flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{report.name} report</p>
                <p className="text-xs text-gray-500 mt-1">{report.hint}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getReportMeta(id: ReportId) {
  switch (id) {
    case 'clinical':
      return {
        title: 'OP CLINICAL REPORT',
        icon: <Stethoscope className="w-5 h-5 text-cyan-200" />,
      };
    case 'therapy':
      return {
        title: 'THERAPY REPORT',
        icon: <Activity className="w-5 h-5 text-cyan-200" />,
      };
    case 'lab':
      return {
        title: 'AUDIO REPORT',
        icon: <Headphones className="w-5 h-5 text-cyan-200" />,
      };
    case 'ai':
      return {
        title: 'AI USAGE REPORT',
        icon: <Bot className="w-5 h-5 text-cyan-200" />,
      };
    default:
      return {
        title: `${id.toUpperCase()} REPORT`,
        icon: <BarChart2 className="w-5 h-5 text-cyan-200" />,
      };
  }
}

function ReportViewer({ id }: { id: ReportId }) {
  const meta = REPORTS.find((r) => r.id === id)!;
  const headerMeta = getReportMeta(id);

  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('monthly'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [pageSize, setPageSize] = useState(25);

  // Filter state for child report viewers
  const [filterQuery, setFilterQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    appointmentsApi
      .getDoctors()
      .then((docs) => setDoctors([...docs].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setDoctors([]));
  }, []);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    loadReport(id, range)
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, range.period, range.startDate, range.endDate]);

  const handleReset = () => {
    setRange(rangeForPeriod('monthly'));
    setFilterQuery('');
    setDoctorFilter('');
    setDeptFilter('');
    setStatusFilter('ALL');
    setProviderFilter('ALL');
  };

  const handlePrint = () => {
    window.print();
  };

  const tableRef = useRef<HTMLDivElement>(null);
  const handleCopy = () => {
    if (!tableRef.current) return;
    const rangeObj = document.createRange();
    rangeObj.selectNode(tableRef.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(rangeObj);
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
          {headerMeta.icon}
          <span className="font-bold text-sm tracking-wide uppercase">{headerMeta.title}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
            {id === 'clinical' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Search Patient / Reg No / Diagnosis</label>
                  <input
                    type="text"
                    placeholder="Search keywords..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Doctor / Provider</label>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
                  >
                    <option value="">All Doctors / Providers</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Department</label>
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
                  >
                    <option value="">All Departments</option>
                    <option value="ENT">OTORHINOLARYNGOLOGY (ENT)</option>
                    <option value="AUDIOLOGY">AUDIOLOGY</option>
                    <option value="SPEECH">SPEECH THERAPY</option>
                    <option value="GENERAL">GENERAL MEDICINE</option>
                  </select>
                </div>
              </>
            )}

            {id === 'therapy' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Search Case / Patient</label>
                  <input
                    type="text"
                    placeholder="Search patient or title..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Case Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DISCONTINUED">DISCONTINUED</option>
                  </select>
                </div>
              </>
            )}

            {id === 'lab' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Search Procedure / Test Code</label>
                  <input
                    type="text"
                    placeholder="Code or procedure name..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Department</label>
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
                  >
                    <option value="">All Departments</option>
                    <option value="AUDIOLOGY">AUDIOLOGY</option>
                    <option value="SPEECH">SPEECH</option>
                    <option value="ENT">ENT</option>
                  </select>
                </div>
              </>
            )}

            {id === 'ai' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">AI Provider</label>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
                  >
                    <option value="ALL">All Providers</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Request Type</label>
                  <input
                    type="text"
                    placeholder="e.g. summary, prescription..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. Query Bar */}
      <HospitalReportQueryBar
        startDate={range.startDate}
        endDate={range.endDate}
        onDateChange={({ startDate, endDate }: ReportDateRange) => {
          setRange({ period: 'custom', startDate, endDate });
        }}
        onExecute={loadData}
        onReset={handleReset}
        isLoading={isLoading}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onExportCsv={
          meta.csv
            ? () => {
                reportsApi.exportCsv(meta.csv!, range.startDate, range.endDate).catch(() => undefined);
              }
            : undefined
        }
        onPrint={handlePrint}
        onCopy={handleCopy}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm border border-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="card p-12 text-center text-gray-500 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#2980b9] mb-2" />
          <span className="text-xs font-medium">Generating {meta.name} report...</span>
        </div>
      ) : (
        <div ref={tableRef} className="space-y-4">
          {payload ? (
            renderHospitalReportBody(id, payload, {
              filterQuery,
              doctorFilter,
              deptFilter,
              statusFilter,
              providerFilter,
              pageSize,
            })
          ) : (
            <div className="card p-8 text-center text-gray-400 text-xs">No records available for query period.</div>
          )}
        </div>
      )}
    </div>
  );
}

async function loadReport(id: ReportId, range: DateRangeValue) {
  const start = range.startDate;
  const end = range.endDate;
  if (id === 'clinical') {
    const [clinicalSummary, casesList] = await Promise.all([
      reportsApi.clinical(start, end),
      clinicalApi.getAll({
        startDate: `${start}T00:00:00`,
        endDate: `${end}T23:59:59.999`,
        limit: 200,
      }).catch(() => ({ data: [] })),
    ]);
    return { summary: clinicalSummary, cases: casesList?.data || [] };
  }
  if (id === 'therapy') {
    const [therapySummary, therapyCases] = await Promise.all([
      reportsApi.therapy(start, end),
      therapyApi.getCases({ limit: 100 }).catch(() => ({ data: [] })),
    ]);
    return { summary: therapySummary, cases: therapyCases?.data || [] };
  }
  if (id === 'ai') return reportsApi.ai(start, end);
  if (id === 'revenue') return billingApi.revenue(start, end, range.period);
  if (id === 'billing') return billingApi.billingReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'stock') return inventoryApi.getStockReport();
  if (id === 'sales') return inventoryApi.getSalesReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'returns') return inventoryApi.getReturnsReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'lab') {
    const [dashboard, procedures] = await Promise.all([
      labApi.getDashboard(),
      labApi.getProcedures({ limit: 100 }),
    ]);
    return { dashboard, procedures: procedures.data || [] };
  }
  return null;
}

function renderHospitalReportBody(
  id: ReportId,
  data: any,
  filters: {
    filterQuery: string;
    doctorFilter: string;
    deptFilter: string;
    statusFilter: string;
    providerFilter: string;
    pageSize: number;
  },
) {
  if (id === 'clinical') return <HospitalClinicalBody data={data} filters={filters} />;
  if (id === 'therapy') return <HospitalTherapyBody data={data} filters={filters} />;
  if (id === 'lab') return <HospitalAudioBody dashboard={data.dashboard} procedures={data.procedures} filters={filters} />;
  if (id === 'ai') return <HospitalAiBody data={data} filters={filters} />;
  return null;
}

/* -------------------------------------------------------------
   1. CLINICAL REPORT BODY
-------------------------------------------------------------- */
function HospitalClinicalBody({
  data,
  filters,
}: {
  data: { summary?: any; cases?: OpCase[] };
  filters: { filterQuery: string; doctorFilter: string; deptFilter: string; pageSize: number };
}) {
  const summary = data?.summary || {};
  const cases = data?.cases || [];
  const [tableFilter, setTableFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const topDiagnoses = summary.topDiagnoses || [];
  const totalDiagnosisCount = topDiagnoses.reduce((s: number, d: any) => s + Number(d.count || 0), 0);

  const filteredCases = useMemo(() => {
    return cases.filter((c: any) => {
      if (filters.doctorFilter && c.provider?.name !== filters.doctorFilter) return false;
      if (filters.deptFilter && c.provider?.department !== filters.deptFilter) return false;
      const q = (filters.filterQuery || tableFilter).toLowerCase().trim();
      if (!q) return true;
      const patientName = c.patient?.name?.toLowerCase() || '';
      const regNo = c.patient?.patientNumber?.toLowerCase() || '';
      const doctor = c.provider?.name?.toLowerCase() || '';
      const complaint = c.chiefComplaint?.toLowerCase() || '';
      const diagStr = (c.diagnoses || []).map((d: any) => `${d.code} ${d.description}`).join(' ').toLowerCase();
      return patientName.includes(q) || regNo.includes(q) || doctor.includes(q) || complaint.includes(q) || diagStr.includes(q);
    });
  }, [cases, filters.doctorFilter, filters.deptFilter, filters.filterQuery, tableFilter]);

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredCases.slice(start, start + filters.pageSize);
  }, [filteredCases, currentPage, filters.pageSize]);

  const totalPages = Math.ceil(filteredCases.length / filters.pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 border-l-4 border-l-blue-500">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total OP Cases</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.opCases || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-emerald-700 font-semibold uppercase">Follow-ups</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.followUps || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-xs text-purple-700 font-semibold uppercase">Prescriptions</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{summary.prescriptions || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-xs text-cyan-700 font-semibold uppercase">Diagnoses</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{totalDiagnosisCount}</p>
        </div>
      </div>

      {/* Top Diagnoses Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="font-bold text-xs uppercase text-gray-700">Top Diagnoses Distribution</span>
          <span className="text-[11px] text-gray-500">{topDiagnoses.length} condition(s) recorded</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 w-14 border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 border-r border-white/20">ICD / CODE</th>
                <th className="px-2.5 py-2 border-r border-white/20">DIAGNOSIS DESCRIPTION</th>
                <th className="px-2.5 py-2 text-right w-28">CASES COUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topDiagnoses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No diagnoses recorded in this period.
                  </td>
                </tr>
              ) : (
                topDiagnoses.map((d: any, idx: number) => (
                  <tr key={idx} className="hover:bg-blue-50/40">
                    <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 font-mono font-semibold text-gray-700 border-r border-gray-200">{d.code || '—'}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gray-900 border-r border-gray-200">{d.description}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold text-cyan-700">{d.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Table Search */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-gray-500 font-medium">
          Showing {filteredCases.length} clinical case(s)
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

      {/* Clinical OP Cases Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">
                  <div className="flex items-center gap-1">
                    <span>S.NO</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">VISIT DATE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">REG NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PATIENT NAME</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">AGE / GENDER</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">DOCTOR</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">CHIEF COMPLAINT</th>
                <th className="px-2.5 py-2 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No clinical cases match query criteria.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c: any, idx: number) => {
                  const sNo = (currentPage - 1) * filters.pageSize + idx + 1;
                  return (
                    <tr key={c.id} className="hover:bg-blue-50/40">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{sNo}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-700 border-r border-gray-200">{formatDateTime(c.createdAt)}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px] text-gray-600 border-r border-gray-200">{c.patient?.patientNumber || '—'}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-gray-900 border-r border-gray-200">{c.patient?.name || '—'}</td>
                      <td className="px-2.5 py-1.5 text-gray-700 border-r border-gray-200">
                        {ageFromDob(c.patient?.dateOfBirth) != null ? `${ageFromDob(c.patient?.dateOfBirth)}y` : '—'} / {c.patient?.gender || '—'}
                      </td>
                      <td className="px-2.5 py-1.5 text-gray-800 font-medium border-r border-gray-200">{c.provider?.name || '—'}</td>
                      <td className="px-2.5 py-1.5 text-gray-600 max-w-[200px] truncate border-r border-gray-200" title={c.chiefComplaint || ''}>
                        {c.chiefComplaint || '—'}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${c.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {c.status}
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
        {filteredCases.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * filters.pageSize + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * filters.pageSize, filteredCases.length)}</span> of{' '}
              <span className="font-semibold">{filteredCases.length}</span> entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${currentPage === i + 1 ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
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

/* -------------------------------------------------------------
   2. THERAPY REPORT BODY
-------------------------------------------------------------- */
function HospitalTherapyBody({
  data,
  filters,
}: {
  data: { summary?: any; cases?: TherapyCase[] };
  filters: { filterQuery: string; statusFilter: string; pageSize: number };
}) {
  const summary = data?.summary || {};
  const cases = data?.cases || [];
  const attendance = Object.entries(summary.attendanceByStatus || {}) as [string, number][];
  const [tableFilter, setTableFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCases = useMemo(() => {
    return cases.filter((c: any) => {
      if (filters.statusFilter !== 'ALL' && c.status !== filters.statusFilter) return false;
      const q = (filters.filterQuery || tableFilter).toLowerCase().trim();
      if (!q) return true;
      const title = c.title?.toLowerCase() || '';
      const patientName = c.patient?.name?.toLowerCase() || '';
      const therapist = c.therapist?.name?.toLowerCase() || '';
      return title.includes(q) || patientName.includes(q) || therapist.includes(q);
    });
  }, [cases, filters.statusFilter, filters.filterQuery, tableFilter]);

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredCases.slice(start, start + filters.pageSize);
  }, [filteredCases, currentPage, filters.pageSize]);

  const totalPages = Math.ceil(filteredCases.length / filters.pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card p-3 border-l-4 border-l-blue-500">
          <p className="text-xs text-gray-500 font-semibold uppercase">Active Cases</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.activeCases || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-emerald-700 font-semibold uppercase">Sessions</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.sessions || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-amber-500">
          <p className="text-xs text-amber-700 font-semibold uppercase">Missed</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.missed || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-xs text-purple-700 font-semibold uppercase">Packages Sold</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{summary.packagesSold || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-xs text-cyan-700 font-semibold uppercase">Package Use</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{summary.packageUtilization || 0}%</p>
        </div>
      </div>

      {/* Attendance Breakdown */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 font-bold text-xs uppercase text-gray-700">
          Attendance Summary
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 w-14 border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 border-r border-white/20">ATTENDANCE STATUS</th>
                <th className="px-2.5 py-2 text-right w-36">COUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-gray-400">
                    No attendance marked in this period.
                  </td>
                </tr>
              ) : (
                attendance.map(([st, cnt], idx) => (
                  <tr key={st} className="hover:bg-blue-50/40">
                    <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gray-800 border-r border-gray-200">{st}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold text-cyan-700">{cnt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Table Search */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-gray-500 font-medium">
          Showing {filteredCases.length} therapy case(s)
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

      {/* Therapy Cases Register */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">CASE TITLE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PATIENT NAME</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">REG NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">THERAPIST</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">STATUS</th>
                <th className="px-2.5 py-2 whitespace-nowrap">CREATED DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No therapy cases found for selected filters.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c: any, idx: number) => {
                  const sNo = (currentPage - 1) * filters.pageSize + idx + 1;
                  return (
                    <tr key={c.id} className="hover:bg-blue-50/40">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{sNo}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-gray-900 border-r border-gray-200">{c.title}</td>
                      <td className="px-2.5 py-1.5 text-gray-800 font-medium border-r border-gray-200">{c.patient?.name || '—'}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px] text-gray-600 border-r border-gray-200">{c.patient?.patientNumber || '—'}</td>
                      <td className="px-2.5 py-1.5 text-gray-700 border-r border-gray-200">{c.therapist?.name || '—'}</td>
                      <td className="px-2.5 py-1.5 border-r border-gray-200">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{formatDate(c.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCases.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * filters.pageSize + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * filters.pageSize, filteredCases.length)}</span> of{' '}
              <span className="font-semibold">{filteredCases.length}</span> entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${currentPage === i + 1 ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
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

/* -------------------------------------------------------------
   3. AUDIO REPORT BODY (LAB)
-------------------------------------------------------------- */
function HospitalAudioBody({
  dashboard,
  procedures,
  filters,
}: {
  dashboard: LabDashboard;
  procedures: LabProcedure[];
  filters: { filterQuery: string; deptFilter: string; pageSize: number };
}) {
  const executed = dashboard?.executed;
  const [tableFilter, setTableFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProcedures = useMemo(() => {
    return procedures.filter((p) => {
      if (filters.deptFilter && p.department !== filters.deptFilter) return false;
      const q = (filters.filterQuery || tableFilter).toLowerCase().trim();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.department.toLowerCase().includes(q);
    });
  }, [procedures, filters.deptFilter, filters.filterQuery, tableFilter]);

  const paginatedProcedures = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredProcedures.slice(start, start + filters.pageSize);
  }, [filteredProcedures, currentPage, filters.pageSize]);

  const totalPages = Math.ceil(filteredProcedures.length / filters.pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 border-l-4 border-l-blue-500">
          <p className="text-xs text-gray-500 font-semibold uppercase">Today Tests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{executed?.today?.tests || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-emerald-700 font-semibold uppercase">This Week</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{executed?.week?.tests || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-xs text-purple-700 font-semibold uppercase">This Month</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{executed?.month?.tests || 0}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-xs text-cyan-700 font-semibold uppercase">Month Billed</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{money(executed?.month?.revenue)}</p>
        </div>
      </div>

      {/* Top Procedures Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 font-bold text-xs uppercase text-gray-700">
          Top Billed Audio Procedures
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 w-16 border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 border-r border-white/20">PROCEDURE NAME</th>
                <th className="px-2.5 py-2 border-r border-white/20">DEPARTMENT</th>
                <th className="px-2.5 py-2 text-right border-r border-white/20">TESTS</th>
                <th className="px-2.5 py-2 text-right">REVENUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(dashboard?.topProcedures || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-400">
                    No billed audio tests recorded yet.
                  </td>
                </tr>
              ) : (
                (dashboard?.topProcedures || []).map((row, idx) => (
                  <tr key={row.name + row.department} className="hover:bg-blue-50/40">
                    <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gray-900 border-r border-gray-200">{row.name}</td>
                    <td className="px-2.5 py-1.5 text-gray-700 border-r border-gray-200">{row.department}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold text-gray-900 border-r border-gray-200">{row.tests}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold text-cyan-700">{money(row.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Table Search */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-gray-500 font-medium">
          Showing {filteredProcedures.length} procedure catalogue item(s)
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

      {/* Audio Procedure Catalogue Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">CODE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PROCEDURE NAME</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">DEPARTMENT</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">SAMPLE TYPE</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">TAT (HRS)</th>
                <th className="px-2.5 py-2 whitespace-nowrap text-right">STANDARD PRICE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProcedures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No procedures match query criteria.
                  </td>
                </tr>
              ) : (
                paginatedProcedures.map((p, idx) => {
                  const sNo = (currentPage - 1) * filters.pageSize + idx + 1;
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{sNo}</td>
                      <td className="px-2.5 py-1.5 font-mono font-semibold text-gray-700 border-r border-gray-200">{p.code}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-gray-900 border-r border-gray-200">{p.name}</td>
                      <td className="px-2.5 py-1.5 text-gray-700 border-r border-gray-200">{p.department}</td>
                      <td className="px-2.5 py-1.5 text-gray-600 border-r border-gray-200">{p.sampleType || '—'}</td>
                      <td className="px-2.5 py-1.5 text-gray-700 border-r border-gray-200">{p.tatHours ? `${p.tatHours}h` : '—'}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-gray-900">{money(p.price)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredProcedures.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * filters.pageSize + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * filters.pageSize, filteredProcedures.length)}</span> of{' '}
              <span className="font-semibold">{filteredProcedures.length}</span> entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${currentPage === i + 1 ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
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

/* -------------------------------------------------------------
   4. AI USAGE REPORT BODY
-------------------------------------------------------------- */
function HospitalAiBody({
  data,
  filters,
}: {
  data: { rows?: any[] };
  filters: { filterQuery: string; providerFilter: string; pageSize: number };
}) {
  const rows = data?.rows || [];
  const requests = rows.reduce((s, r) => s + Number(r.requests || 0), 0);
  const promptTokens = rows.reduce((s, r) => s + Number(r.promptTokens || 0), 0);
  const completionTokens = rows.reduce((s, r) => s + Number(r.completionTokens || 0), 0);
  const totalTokens = promptTokens + completionTokens;

  const [tableFilter, setTableFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filters.providerFilter !== 'ALL' && r.provider?.toLowerCase() !== filters.providerFilter.toLowerCase()) return false;
      const q = (filters.filterQuery || tableFilter).toLowerCase().trim();
      if (!q) return true;
      return r.provider?.toLowerCase().includes(q) || r.requestType?.toLowerCase().includes(q);
    });
  }, [rows, filters.providerFilter, filters.filterQuery, tableFilter]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredRows.slice(start, start + filters.pageSize);
  }, [filteredRows, currentPage, filters.pageSize]);

  const totalPages = Math.ceil(filteredRows.length / filters.pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 border-l-4 border-l-blue-500">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{requests}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-emerald-700 font-semibold uppercase">Total Tokens</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalTokens.toLocaleString('en-IN')}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-xs text-purple-700 font-semibold uppercase">Prompt Tokens</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{promptTokens.toLocaleString('en-IN')}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-xs text-cyan-700 font-semibold uppercase">Active Providers</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{new Set(rows.map((r) => r.provider)).size}</p>
        </div>
      </div>

      {/* Quick Table Search */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-gray-500 font-medium">
          Showing {filteredRows.length} provider usage row(s)
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

      {/* Usage Register Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">S.NO</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">PROVIDER</th>
                <th className="px-2.5 py-2 whitespace-nowrap border-r border-white/20">REQUEST TYPE</th>
                <th className="px-2.5 py-2 whitespace-nowrap text-right border-r border-white/20">REQUESTS</th>
                <th className="px-2.5 py-2 whitespace-nowrap text-right border-r border-white/20">PROMPT TOKENS</th>
                <th className="px-2.5 py-2 whitespace-nowrap text-right border-r border-white/20">COMPLETION TOKENS</th>
                <th className="px-2.5 py-2 whitespace-nowrap text-right">TOTAL TOKENS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No AI usage records found for selected period.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const sNo = (currentPage - 1) * filters.pageSize + idx + 1;
                  const rowPrompt = Number(r.promptTokens || 0);
                  const rowComp = Number(r.completionTokens || 0);
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40">
                      <td className="px-2.5 py-1.5 font-mono text-gray-500 border-r border-gray-200">{sNo}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-gray-900 capitalize border-r border-gray-200">{r.provider}</td>
                      <td className="px-2.5 py-1.5 text-gray-700 font-mono text-[11px] border-r border-gray-200">{r.requestType}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-gray-900 border-r border-gray-200">{r.requests}</td>
                      <td className="px-2.5 py-1.5 text-right text-gray-600 border-r border-gray-200">{rowPrompt.toLocaleString('en-IN')}</td>
                      <td className="px-2.5 py-1.5 text-right text-gray-600 border-r border-gray-200">{rowComp.toLocaleString('en-IN')}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-cyan-700">{(rowPrompt + rowComp).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRows.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * filters.pageSize + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * filters.pageSize, filteredRows.length)}</span> of{' '}
              <span className="font-semibold">{filteredRows.length}</span> entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1 rounded border text-xs cursor-pointer ${currentPage === i + 1 ? 'bg-[#2980b9] text-white border-[#2980b9] font-bold' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
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
