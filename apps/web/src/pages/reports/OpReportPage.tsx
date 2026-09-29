import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Copy,
  FileSpreadsheet,
  FileText,
  Columns,
  Calendar,
  RotateCcw,
  Play,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  X,
  ArrowUpDown,
  FileCheck,
} from 'lucide-react';
import { clinicalApi } from '../../services/clinical';
import { appointmentsApi } from '../../services/appointments';
import type { OpCase } from '../../types/clinical';
import { ageFromDob, formatAddress } from '../../lib/age';

type DoctorOption = { id: string; name: string; department?: string };

// Helper to format Date to DD-MM-YYYY HH:mm
function formatVisitDate(value?: string | Date) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

// Helper to format Date to DD-MM-YYYY
function formatDateOnly(value?: string | Date) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Helper for date math
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function OpReportPage() {
  // Collapsible filter panel
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Search filter states
  const [regNo, setRegNo] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [department, setDepartment] = useState('');
  const [visitType, setVisitType] = useState<'ALL' | 'NEW' | 'REVIEW'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Date range picker states
  const todayIso = toIsoDate(new Date());
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const [tempStart, setTempStart] = useState(todayIso);
  const [tempEnd, setTempEnd] = useState(todayIso);

  // Doctors & Departments
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // Results & Table states
  const [cases, setCases] = useState<OpCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [copySuccess, setCopySuccess] = useState(false);
  const [groupByDoctor, setGroupByDoctor] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sno: true,
    regNo: true,
    tokenNo: true,
    visitDate: true,
    visitType: true,
    abhaId: true,
    name: true,
    age: true,
    gender: true,
    department: true,
    doctor: true,
    relationName: true,
    mobile: true,
    address: true,
  });
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);

  // Print ref
  const tableRef = useRef<HTMLTableElement>(null);

  // Load doctors on mount
  useEffect(() => {
    appointmentsApi
      .getDoctors()
      .then((docs) => setDoctors([...docs].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setDoctors([]));
  }, []);

  // Fetch report data
  const fetchReport = async () => {
    setIsLoading(true);
    setCurrentPage(1);

    try {
      const res = await clinicalApi.getAll({
        page: 1,
        limit: 500,
        regNo: regNo.trim() || undefined,
        patientName: patientName.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        providerId: doctorId || undefined,
        status: status !== 'ALL' ? status : undefined,
        startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
        endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
      });

      let list = res.data || [];

      // Client-side Visit Type filter (NEW vs REVIEW)
      if (visitType !== 'ALL') {
        list = list.filter((c: any) => {
          const isReview = Boolean(c.vitals?.isReview || (c.visits && c.visits.length > 0));
          return visitType === 'REVIEW' ? isReview : !isReview;
        });
      }

      setCases(list);
    } catch {
      setCases([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preset Date range selection
  const applyPreset = (preset: string) => {
    const now = new Date();
    let s = new Date();
    let e = new Date();

    switch (preset) {
      case 'today':
        s = now;
        e = now;
        break;
      case 'yesterday':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        e = s;
        break;
      case 'last7':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        e = now;
        break;
      case 'last30':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        e = now;
        break;
      case 'thisMonth':
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        e = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    }

    const sIso = toIsoDate(s);
    const eIso = toIsoDate(e);
    setTempStart(sIso);
    setTempEnd(eIso);
    setStartDate(sIso);
    setEndDate(eIso);
    setIsDatePopupOpen(false);
  };

  // Reset all filters
  const handleReset = () => {
    setRegNo('');
    setPatientName('');
    setPhone('');
    setDoctorId('');
    setDepartment('');
    setVisitType('ALL');
    setStatus('ALL');
    setStartDate(todayIso);
    setEndDate(todayIso);
    setTableFilter('');
  };

  // Export to Excel / CSV
  const handleExportCsv = () => {
    if (cases.length === 0) return;

    const headers = [
      'S.No',
      'Reg No',
      'Token No',
      'Visit Date',
      'Visit Type',
      'UHID',
      'Patient Name',
      'Age',
      'Gender',
      'Department',
      'Doctor',
      'Relation Name',
      'Mobile',
      'Address',
    ];

    const rows = cases.map((c: any, index) => {
      const p = c.patient || {};
      const pAge = ageFromDob(p.dateOfBirth);
      const isReview = Boolean(c.vitals?.isReview || (c.visits && c.visits.length > 0));
      const relData = p.emergencyContact as Record<string, string> | undefined;
      const doc = c.provider?.name || '—';
      const dept = c.provider?.department || c.provider?.specialization || 'OP';

      return [
        index + 1,
        `"${p.patientNumber || ''}"`,
        `"OP-${String(index + 1).padStart(2, '0')}"`,
        `"${formatVisitDate(c.createdAt)}"`,
        isReview ? 'REVIEW' : 'NEW',
        `"${p.id || ''}"`,
        `"${p.name || ''}"`,
        pAge != null ? `${pAge} Y` : '',
        p.gender || '',
        `"${dept}"`,
        `"${doc}"`,
        `"${relData?.name || ''}"`,
        `"${p.phone || ''}"`,
        `"${formatAddress(p.address).replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OP_REPORT_${startDate}_TO_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy table to clipboard
  const handleCopy = () => {
    if (cases.length === 0) return;
    const headers = [
      'S.No\tReg No\tToken No\tVisit Date\tVisit Type\tPatient Name\tAge\tGender\tDepartment\tDoctor\tRelation Name\tMobile\tAddress',
    ];
    const rows = cases.map((c: any, idx) => {
      const p = c.patient || {};
      const pAge = ageFromDob(p.dateOfBirth);
      const isReview = Boolean(c.vitals?.isReview || (c.visits && c.visits.length > 0));
      const relData = p.emergencyContact as Record<string, string> | undefined;
      const doc = c.provider?.name || '—';
      const dept = c.provider?.department || c.provider?.specialization || 'OP';
      return `${idx + 1}\t${p.patientNumber || ''}\tOP-${idx + 1}\t${formatVisitDate(c.createdAt)}\t${
        isReview ? 'REVIEW' : 'NEW'
      }\t${p.name || ''}\t${pAge != null ? `${pAge} Y` : ''}\t${p.gender || ''}\t${dept}\t${doc}\t${
        relData?.name || ''
      }\t${p.phone || ''}\t${formatAddress(p.address)}`;
    });

    navigator.clipboard.writeText([headers, ...rows].join('\n'));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // In-table quick search filter
  const filteredCases = useMemo(() => {
    if (!tableFilter.trim()) return cases;
    const q = tableFilter.toLowerCase().trim();
    return cases.filter((c: any) => {
      const pName = (c.patient?.name || '').toLowerCase();
      const pNum = (c.patient?.patientNumber || '').toLowerCase();
      const pPhone = (c.patient?.phone || '').toLowerCase();
      const doc = (c.provider?.name || '').toLowerCase();
      const dept = (c.provider?.department || c.provider?.specialization || '').toLowerCase();
      const addr = formatAddress(c.patient?.address).toLowerCase();
      const rel = ((c.patient?.emergencyContact as any)?.name || '').toLowerCase();
      return (
        pName.includes(q) ||
        pNum.includes(q) ||
        pPhone.includes(q) ||
        doc.includes(q) ||
        dept.includes(q) ||
        addr.includes(q) ||
        rel.includes(q)
      );
    });
  }, [cases, tableFilter]);

  // Grouped or ungrouped cases
  const paginatedData = useMemo(() => {
    if (pageSize === 9999) return filteredCases;
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  const totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredCases.length / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#2980b9] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-white" />
          <h1 className="text-base font-bold tracking-wide uppercase">OP REPORT</h1>
          <span className="text-xs text-blue-100 font-normal pl-2 border-l border-blue-400">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            {/* Column 1 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reg No</label>
              <input
                type="text"
                placeholder="Reg No"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono transition-colors"
              />
            </div>

            {/* Column 2 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Patient Name</label>
              <input
                type="text"
                placeholder="Patient Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              />
            </div>

            {/* Column 3 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="">All Doctors / Providers</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Column 4 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Visit Type</label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as any)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Visit Types</option>
                <option value="NEW">NEW</option>
                <option value="REVIEW">REVIEW</option>
              </select>
            </div>

            {/* Row 2: Department, Mobile, Status */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="">All Departments</option>
                <option value="ENT">OTORHINOLARYNGOLOGY (ENT)</option>
                <option value="AUDIOLOGY">AUDIOLOGY</option>
                <option value="SPEECH">SPEECH THERAPY</option>
                <option value="GENERAL">GENERAL MEDICINE</option>
                <option value="PAEDIATRICS">PAEDIATRICS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Mobile</label>
              <input
                type="text"
                placeholder="Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Case Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div className="flex items-end pb-1 text-xs text-gray-600">
              <span className="font-semibold text-blue-700">
                Total Visits: {filteredCases.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Toolbar Row with Export Actions and Date Range Controls */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 pt-1">
        {/* Left: Export & View Actions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Print
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Copy Table to Clipboard"
          >
            {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
            {copySuccess ? 'Copied!' : 'Copy'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Export to Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Save as PDF"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            PDF
          </button>

          {/* Column View Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColMenuOpen((p) => !p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            >
              <Columns className="w-3.5 h-3.5 text-indigo-600" />
              Column View
            </button>

            {isColMenuOpen && (
              <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50 text-xs space-y-1">
                <div className="font-semibold text-gray-700 pb-1 border-b border-gray-100 flex items-center justify-between">
                  <span>Toggle Columns</span>
                  <button
                    type="button"
                    onClick={() => setIsColMenuOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {Object.keys(visibleColumns).map((col) => (
                  <label key={col} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer capitalize">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{col.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Page Length */}
          <div className="inline-flex items-center gap-1 border border-gray-300 rounded bg-white px-2 py-1 shadow-2xs">
            <span className="text-gray-500">Page Length:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent font-medium text-gray-800 focus:outline-hidden cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>All</option>
            </select>
          </div>
        </div>

        {/* Right: Group toggle, Date Range Pill, GO, RESET */}
        <div className="flex flex-wrap items-center gap-2 text-xs relative">
          {/* No Group / Group by Doctor */}
          <button
            type="button"
            onClick={() => setGroupByDoctor((p) => !p)}
            className={`px-3 py-1.5 rounded font-semibold tracking-wide transition-colors cursor-pointer ${
              groupByDoctor
                ? 'bg-blue-600 text-white'
                : 'bg-[#3c6382] text-white hover:bg-[#2b4c65]'
            }`}
          >
            {groupByDoctor ? 'GROUPED' : 'NO GROUP'}
          </button>

          {/* Date Range Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTempStart(startDate);
                setTempEnd(endDate);
                setIsDatePopupOpen((p) => !p);
              }}
              className="px-3 py-1.5 rounded bg-[#1e272e] hover:bg-[#2f3640] text-white font-mono text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              title="Change Query date range"
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {formatDateOnly(startDate)} TO {formatDateOnly(endDate)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Date Range Popover */}
            {isDatePopupOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="font-bold text-gray-800 text-xs">Select Date Range</span>
                  <button
                    type="button"
                    onClick={() => setIsDatePopupOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preset buttons */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => applyPreset('today')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('yesterday')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last7')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last30')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('thisMonth')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('lastMonth')}
                    className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
                  >
                    Last Month
                  </button>
                </div>

                {/* Custom inputs */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <span className="font-semibold text-gray-600 block text-[11px] uppercase">
                    Custom Range
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">FROM</label>
                      <input
                        type="date"
                        value={tempStart}
                        onChange={(e) => setTempStart(e.target.value)}
                        className="input h-8 text-xs py-0 px-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">TO</label>
                      <input
                        type="date"
                        value={tempEnd}
                        onChange={(e) => setTempEnd(e.target.value)}
                        className="input h-8 text-xs py-0 px-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Apply / Cancel */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsDatePopupOpen(false)}
                    className="px-3 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(tempStart);
                      setEndDate(tempEnd);
                      setIsDatePopupOpen(false);
                    }}
                    className="px-4 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GO Button */}
          <button
            type="button"
            onClick={fetchReport}
            disabled={isLoading}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            GO
          </button>

          {/* RESET Button */}
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET
          </button>
        </div>
      </div>

      {/* Quick Search inside Table */}
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

      {/* 4. OP Report Hospital Records Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                {visibleColumns.sno && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>S.NO</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.regNo && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>REG NO</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.tokenNo && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>TOKEN NO</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.visitDate && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>VISIT DATE</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.visitType && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>VISIT TYPE</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.abhaId && (
                  <th className="px-3 py-2.5 whitespace-nowrap">ABHA ID / UHID</th>
                )}
                {visibleColumns.name && (
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>NAME</span>
                      <ArrowUpDown className="w-3 h-3 opacity-70" />
                    </div>
                  </th>
                )}
                {visibleColumns.age && (
                  <th className="px-3 py-2.5 whitespace-nowrap">AGE</th>
                )}
                {visibleColumns.gender && (
                  <th className="px-3 py-2.5 whitespace-nowrap">GENDER</th>
                )}
                {visibleColumns.department && (
                  <th className="px-3 py-2.5 whitespace-nowrap">DEPARTMENT</th>
                )}
                {visibleColumns.doctor && (
                  <th className="px-3 py-2.5 whitespace-nowrap">DOCTOR</th>
                )}
                {visibleColumns.relationName && (
                  <th className="px-3 py-2.5 whitespace-nowrap">FATHER / SPOUSE NAME</th>
                )}
                {visibleColumns.mobile && (
                  <th className="px-3 py-2.5 whitespace-nowrap">MOBILE</th>
                )}
                {visibleColumns.address && (
                  <th className="px-3 py-2.5 whitespace-nowrap">ADDRESS</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Generating OP report...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-gray-400">
                    No OP visits found for the selected query date range ({formatDateOnly(startDate)} to {formatDateOnly(endDate)}).
                  </td>
                </tr>
              ) : (
                paginatedData.map((c: any, index) => {
                  const p = c.patient || {};
                  const patientAge = ageFromDob(p.dateOfBirth);
                  const isReview = Boolean(c.vitals?.isReview || (c.visits && c.visits.length > 0));
                  const relData = p.emergencyContact as Record<string, string> | undefined;
                  const relName = relData?.name || '—';
                  const docName = c.provider?.name
                    ? c.provider.name.startsWith('Dr')
                      ? c.provider.name
                      : `Dr. ${c.provider.name}`
                    : '—';
                  const dept =
                    c.provider?.department || c.provider?.specialization || 'OP';
                  const formattedAddr = formatAddress(p.address);
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-cyan-50/40 transition-colors group"
                    >
                      {visibleColumns.sno && (
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {rowNumber}
                        </td>
                      )}
                      {visibleColumns.regNo && (
                        <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                          <Link
                            to={`/patients/${p.id}`}
                            className="hover:underline"
                            title="Open patient profile"
                          >
                            {p.patientNumber || '—'}
                          </Link>
                        </td>
                      )}
                      {visibleColumns.tokenNo && (
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                          OP-{String(rowNumber).padStart(2, '0')}
                        </td>
                      )}
                      {visibleColumns.visitDate && (
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {formatVisitDate(c.createdAt)}
                        </td>
                      )}
                      {visibleColumns.visitType && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isReview
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isReview ? 'REVIEW' : 'NEW'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.abhaId && (
                        <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                          {p.id ? p.id.slice(-8).toUpperCase() : '—'}
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap">
                          {p.name}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {patientAge != null ? `${patientAge} Y` : '—'}
                        </td>
                      )}
                      {visibleColumns.gender && (
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700 uppercase">
                          {p.gender || '—'}
                        </td>
                      )}
                      {visibleColumns.department && (
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700 uppercase">
                          {dept}
                        </td>
                      )}
                      {visibleColumns.doctor && (
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">
                          {docName}
                        </td>
                      )}
                      {visibleColumns.relationName && (
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                          {relName}
                        </td>
                      )}
                      {visibleColumns.mobile && (
                        <td className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap">
                          {p.phone || '—'}
                        </td>
                      )}
                      {visibleColumns.address && (
                        <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={formattedAddr}>
                          {formattedAddr || '—'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCases.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredCases.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length} visits
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
