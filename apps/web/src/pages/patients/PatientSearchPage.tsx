import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  User,
  X,
  BookOpen,
  ArrowUpDown,
  RotateCcw,
  Calendar,
  FileText,
  CreditCard,
} from 'lucide-react';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { appointmentsApi } from '../../services/appointments';
import { ageFromDob, formatAddress } from '../../lib/age';

type DoctorOption = { id: string; name: string };

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function when(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-IN')} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function PatientSearchPage() {
  // Search filter states
  const [matchMode, setMatchMode] = useState<'startsWith' | 'contains'>('startsWith');
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [relationName, setRelationName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [visitType, setVisitType] = useState<'ALL' | 'OP' | 'THERAPY'>('ALL');

  // Doctors list for dropdown
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // Results & UI states
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected patient for preview modal / drawer
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchHit | null>(null);

  // Load doctors on mount
  useEffect(() => {
    appointmentsApi
      .getDoctors()
      .then((docs) => setDoctors([...docs].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setDoctors([]));
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const hits = await patientsApi.search('', 200, {
        matchMode,
        name: name.trim() || undefined,
        regNo: regNo.trim() || undefined,
        phone: mobile.trim() || undefined,
        gender: gender !== 'ALL' ? gender : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        doctorId: doctorId || undefined,
        address: (address.trim() || city.trim()) ? `${address} ${city}`.trim() : undefined,
        relationName: relationName.trim() || undefined,
        visitType: visitType !== 'ALL' ? visitType : undefined,
      });

      // Filter by age in memory if specified
      let filtered = hits;
      if (age.trim()) {
        const targetAge = parseInt(age.trim(), 10);
        if (!isNaN(targetAge)) {
          filtered = hits.filter((p) => {
            const pAge = ageFromDob(p.dateOfBirth);
            return pAge === targetAge;
          });
        }
      }

      setResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setName('');
    setRegNo('');
    setDateFrom('');
    setDateTo('');
    setRelationName('');
    setMobile('');
    setAge('');
    setGender('ALL');
    setAddress('');
    setCity('');
    setDoctorId('');
    setVisitType('ALL');
    setMatchMode('startsWith');
    setResults([]);
    setTableFilter('');
    setError(null);
    setHasSearched(false);
    setSelectedPatient(null);
  };

  // In-table quick search
  const filteredResults = useMemo(() => {
    if (!tableFilter.trim()) return results;
    const q = tableFilter.toLowerCase().trim();
    return results.filter((p) => {
      const pName = p.name.toLowerCase();
      const pNum = p.patientNumber.toLowerCase();
      const pPhone = (p.phone || '').toLowerCase();
      const pAlt = (p.alternatePhone || '').toLowerCase();
      const pAddr = formatAddress(p.address).toLowerCase();
      const pRel = ((p.emergencyContact as any)?.name || '').toLowerCase();
      const doc = (p.opCases?.[0]?.provider?.name || p.appointments?.[0]?.provider?.name || '').toLowerCase();
      return (
        pName.includes(q) ||
        pNum.includes(q) ||
        pPhone.includes(q) ||
        pAlt.includes(q) ||
        pAddr.includes(q) ||
        pRel.includes(q) ||
        doc.includes(q)
      );
    });
  }, [results, tableFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl uppercase">
              Patient Search
            </h1>
            <p className="text-xs text-gray-500">
              Search by date range, registration number, demographics, or provider
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Hospital Filter Panel */}
      <div className="card p-5 space-y-4 bg-white border border-gray-200/80 rounded-xl shadow-xs">
        {/* Match mode radios */}
        <div className="flex flex-wrap items-center gap-6 pb-3 border-b border-gray-100 text-xs text-gray-700">
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Search Mode:</span>
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="radio"
              name="searchMatchMode"
              checked={matchMode === 'startsWith'}
              onChange={() => setMatchMode('startsWith')}
              className="text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Starts With</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="radio"
              name="searchMatchMode"
              checked={matchMode === 'contains'}
              onChange={() => setMatchMode('contains')}
              className="text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Contains (Name, Relation Name and Address)</span>
          </label>
        </div>

        {/* Row 1: Name, Reg No, Reg Date-From, Reg Date-To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label className="label mb-1 text-xs text-gray-700">Name</label>
            <input
              type="text"
              className="input h-9 text-xs"
              placeholder="Patient Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700">Reg No</label>
            <input
              type="text"
              className="input h-9 text-xs font-mono uppercase"
              placeholder="e.g. P000001"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700 flex items-center justify-between">
              <span>Reg Date-From</span>
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
            </label>
            <input
              type="date"
              className="input h-9 text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700 flex items-center justify-between">
              <span>Reg Date-To</span>
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
            </label>
            <input
              type="date"
              className="input h-9 text-xs"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2: Relation Name, Mobile, Age, Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 items-end">
          <div>
            <label className="label mb-1 text-xs text-gray-700">Relation Name</label>
            <input
              type="text"
              className="input h-9 text-xs"
              placeholder="Father / Guardian Name"
              value={relationName}
              onChange={(e) => setRelationName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700">Mobile</label>
            <input
              type="text"
              className="input h-9 text-xs font-mono"
              placeholder="Phone Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700">Age</label>
            <input
              type="number"
              min={0}
              className="input h-9 text-xs"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="h-9 flex flex-col justify-end">
            <span className="text-xs text-gray-600 mb-1.5 block">Gender</span>
            <div className="flex items-center gap-4 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchGender"
                  checked={gender === 'MALE'}
                  onChange={() => setGender('MALE')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Male</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchGender"
                  checked={gender === 'FEMALE'}
                  onChange={() => setGender('FEMALE')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Female</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchGender"
                  checked={gender === 'ALL'}
                  onChange={() => setGender('ALL')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>

        {/* Row 3: Address, City, Doctor, Visit Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 items-end">
          <div>
            <label className="label mb-1 text-xs text-gray-700">Address</label>
            <input
              type="text"
              className="input h-9 text-xs"
              placeholder="Street / Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700">City</label>
            <input
              type="text"
              className="input h-9 text-xs"
              placeholder="City / District"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="label mb-1 text-xs text-gray-700">Doctor</label>
            <select
              className="input h-9 text-xs"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">All Doctors / Providers</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="h-9 flex flex-col justify-end">
            <span className="text-xs text-gray-600 mb-1.5 block">Type</span>
            <div className="flex items-center gap-4 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchVisitType"
                  checked={visitType === 'OP'}
                  onChange={() => setVisitType('OP')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>OP</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchVisitType"
                  checked={visitType === 'THERAPY'}
                  onChange={() => setVisitType('THERAPY')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Therapy</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchVisitType"
                  checked={visitType === 'ALL'}
                  onChange={() => setVisitType('ALL')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Bar & Quick In-Table Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <select
            className="input h-8 text-xs w-20 py-0"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>records per page</span>
          {hasSearched && (
            <span className="font-semibold text-gray-800 ml-1">
              ({filteredResults.length} patient{filteredResults.length === 1 ? '' : 's'} found)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 font-medium">Search:</span>
          <input
            type="text"
            className="input h-8 text-xs w-52"
            placeholder="Quick filter in results..."
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Hospital Patient Records Table */}
      <div className="card overflow-hidden border border-gray-200/90 rounded-xl shadow-xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg No</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg Date</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Age/Gender</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Mobile</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">Alternative No</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Address</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Relation</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Relation Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Doctor</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Department</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    Searching patient records…
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                    {hasSearched
                      ? 'No patient records match the selected date range or criteria'
                      : 'Select a date range or enter search criteria and click SEARCH to view records'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((p) => {
                  const patientAge = ageFromDob(p.dateOfBirth);
                  const formattedAddr = formatAddress(p.address);
                  const relData = p.emergencyContact as Record<string, string> | undefined;
                  const relationType = relData?.relationship || '—';
                  const relName = relData?.name || '—';

                  const primaryDoc =
                    p.opCases?.[0]?.provider?.name ||
                    p.appointments?.[0]?.provider?.name ||
                    '—';
                  const docName =
                    primaryDoc.startsWith('Dr') || primaryDoc === '—'
                      ? primaryDoc
                      : `Dr. ${primaryDoc}`;

                  const dept =
                    p.opCases?.[0]?.provider?.department ||
                    p.appointments?.[0]?.provider?.department ||
                    p.opCases?.[0]?.provider?.specialization ||
                    'OP';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedPatient(p)}
                    >
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {p.patientNumber}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-600">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-gray-900 whitespace-nowrap">
                        <Link
                          to={`/patients/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-700">
                        {[
                          patientAge != null ? `${patientAge} Y` : null,
                          p.gender ? p.gender.charAt(0) + p.gender.slice(1).toLowerCase() : null,
                        ]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-gray-800 whitespace-nowrap">
                        {p.phone || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-gray-500 whitespace-nowrap">
                        {p.alternatePhone || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-600 max-w-xs truncate" title={formattedAddr}>
                        {formattedAddr || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">
                        {relationType}
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">
                        {relName}
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-700 whitespace-nowrap font-medium">
                        {docName}
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap uppercase">
                        {dept}
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatient(p);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {filteredResults.length > 0 && (
          <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredResults.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredResults.length)} of {filteredResults.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-gray-800">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient Previous Records Modal / Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#487eb0] text-white flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-md">
                  {selectedPatient.patientNumber}
                </span>
                <h2 className="text-lg font-bold mt-1 text-white">{selectedPatient.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/patients/${selectedPatient.id}`}
                  className="px-3 py-1.5 rounded-lg bg-white text-blue-900 font-semibold text-xs hover:bg-blue-50 inline-flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" /> Full profile
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Demographics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
                <div>
                  <p className="text-gray-500 font-medium">Mobile</p>
                  <p className="font-mono font-semibold text-gray-900 mt-0.5">
                    {selectedPatient.phone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Age / Gender</p>
                  <p className="font-semibold text-gray-900 mt-0.5">
                    {[
                      ageFromDob(selectedPatient.dateOfBirth) != null
                        ? `${ageFromDob(selectedPatient.dateOfBirth)} Y`
                        : null,
                      selectedPatient.gender,
                    ]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Alternative No</p>
                  <p className="font-mono text-gray-700 mt-0.5">
                    {selectedPatient.alternatePhone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Registered On</p>
                  <p className="font-semibold text-gray-900 mt-0.5">
                    {formatDate(selectedPatient.createdAt)}
                  </p>
                </div>
              </div>

              {/* Address & Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white space-y-1">
                  <p className="font-semibold text-gray-700">Residential Address</p>
                  <p className="text-gray-600 leading-relaxed">
                    {formatAddress(selectedPatient.address) || 'No address on file'}
                  </p>
                </div>

                <div className="p-3.5 border border-gray-200 rounded-xl bg-white space-y-1">
                  <p className="font-semibold text-gray-700">Relation / Emergency Contact</p>
                  <p className="text-gray-600">
                    {(selectedPatient.emergencyContact as any)?.name || '—'}
                    {(selectedPatient.emergencyContact as any)?.relationship
                      ? ` (${(selectedPatient.emergencyContact as any)?.relationship})`
                      : ''}
                  </p>
                  {(selectedPatient.emergencyContact as any)?.phone && (
                    <p className="font-mono text-gray-600">
                      {(selectedPatient.emergencyContact as any)?.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Recent OP Visits */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Recent OP Visits
                </h3>
                {selectedPatient.opCases && selectedPatient.opCases.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="px-3 py-2">Visit Date</th>
                          <th className="px-3 py-2">Doctor</th>
                          <th className="px-3 py-2">Chief Complaint</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedPatient.opCases.map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{when(c.createdAt)}</td>
                            <td className="px-3 py-2 font-medium">
                              {c.provider?.name || '—'}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{c.chiefComplaint || '—'}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {c.status || 'OPEN'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg">
                    No OP visits found.
                  </p>
                )}
              </div>

              {/* Recent Invoices */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Recent Invoices & Bills
                </h3>
                {selectedPatient.invoices && selectedPatient.invoices.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="px-3 py-2">Invoice #</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedPatient.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="px-3 py-2 font-mono font-medium text-blue-600">
                              {inv.invoiceNumber || '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                            <td className="px-3 py-2 font-semibold">
                              ₹{(inv.grandTotal ?? 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                                {inv.status || 'ISSUED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg">
                    No billing history on file.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="btn-secondary px-4 py-1.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
