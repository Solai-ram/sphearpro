import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  User,
  Phone,
  Clock,
  X,
  BookOpen,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { appointmentsApi } from '../../services/appointments';
import { ageFromDob, formatAddress } from '../../lib/age';

type DoctorOption = { id: string; name: string };

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
      const hits = await patientsApi.search('', 100, {
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
    <div className="space-y-4">
      {/* Top Header with PATIENT SEARCH title and Search / Clear action buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-rose-600" />
          <h1 className="text-xl font-bold tracking-wide text-rose-600 uppercase">
            Patient Search
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Hospital Filter Panel */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
        {/* Match mode radios */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-700 font-medium">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="matchMode"
              checked={matchMode === 'startsWith'}
              onChange={() => setMatchMode('startsWith')}
              className="text-emerald-600 focus:ring-emerald-500"
            />
            <span>Starts With</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="matchMode"
              checked={matchMode === 'contains'}
              onChange={() => setMatchMode('contains')}
              className="text-emerald-600 focus:ring-emerald-500"
            />
            <span>Contains (Name, Relation Name and Address)</span>
          </label>
        </div>

        {/* Row 1: Name, Reg No, Reg Date-From, Reg Date-To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Patient Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg No</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono uppercase transition-colors"
              placeholder="e.g. P000001"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg Date-From</label>
            <input
              type="date"
              className="w-full text-sm py-1 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg Date-To</label>
            <input
              type="date"
              className="w-full text-sm py-1 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2: Relation Name, Mobile, Age, Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Relation Name</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Father / Guardian Name"
              value={relationName}
              onChange={(e) => setRelationName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Mobile</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono transition-colors"
              placeholder="Phone Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Age</label>
            <input
              type="number"
              min={0}
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="pb-1">
            <label className="block text-xs text-gray-500 mb-1">Gender</label>
            <div className="flex items-center gap-4 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === 'MALE'}
                  onChange={() => setGender('MALE')}
                  className="text-cyan-600"
                />
                <span>Male</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === 'FEMALE'}
                  onChange={() => setGender('FEMALE')}
                  className="text-cyan-600"
                />
                <span>Female</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === 'ALL'}
                  onChange={() => setGender('ALL')}
                  className="text-cyan-600"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>

        {/* Row 3: Address, City, Doctor, Visit Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Street / Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="City / District"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Doctor</label>
            <select
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
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

          <div className="pb-1">
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <div className="flex items-center gap-3 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="visitType"
                  checked={visitType === 'OP'}
                  onChange={() => setVisitType('OP')}
                  className="text-cyan-600"
                />
                <span>OP</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="visitType"
                  checked={visitType === 'THERAPY'}
                  onChange={() => setVisitType('THERAPY')}
                  className="text-cyan-600"
                />
                <span>Therapy</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="visitType"
                  checked={visitType === 'ALL'}
                  onChange={() => setVisitType('ALL')}
                  className="text-cyan-600"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Bar & Quick In-Table Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-hidden"
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
            <span className="font-semibold text-gray-700">
              ({filteredResults.length} patient{filteredResults.length === 1 ? '' : 's'} found)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 font-medium">Search:</span>
          <input
            type="text"
            className="border border-gray-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-hidden bg-white w-48"
            placeholder="Quick table filter..."
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Hospital Patient Records Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg No</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg Date</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Age/Gender</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Mobile</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">Alternative No</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Address</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Relation Name</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Doctor</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Searching patient records…
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500 italic">
                    {hasSearched
                      ? 'No data available in table for the selected search filters'
                      : 'Type patient criteria above and click SEARCH to view records'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((p, idx) => {
                  const pAge = ageFromDob(p.dateOfBirth);
                  const regDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—';
                  const pAddress = formatAddress(p.address) || '—';
                  const rel = (p.emergencyContact as any)?.name || '—';
                  const doc =
                    p.opCases?.[0]?.provider?.name ||
                    p.appointments?.[0]?.provider?.name ||
                    '—';
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-cyan-50/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-blue-700 whitespace-nowrap">
                        {p.patientNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{regDate}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {[pAge != null ? `${pAge} Y` : null, p.gender && p.gender !== 'UNKNOWN' ? p.gender : null]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-800">{p.phone || '—'}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-600">
                        {p.alternatePhone || '—'}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-gray-600" title={pAddress}>
                        {pAddress}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{rel}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{doc}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPatient(p)}
                            title="Quick view visits & invoices"
                            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium transition-colors"
                          >
                            Records
                          </button>
                          <Link
                            to={`/patients/${p.id}`}
                            title="Open full patient profile"
                            className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            Profile
                            <ExternalLink className="w-3 h-3 text-gray-500" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {filteredResults.length > pageSize && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredResults.length)} of {filteredResults.length} records
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

      {/* Patient Previous Records Modal / Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#487eb0] text-white flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded">
                  {selectedPatient.patientNumber}
                </span>
                <h2 className="text-lg font-bold mt-1 text-white">{selectedPatient.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/patients/${selectedPatient.id}`}
                  className="px-2.5 py-1 rounded bg-white text-blue-900 font-semibold text-xs hover:bg-blue-50 inline-flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" /> Full profile
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Demographics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
                <div>
                  <p className="text-gray-500">Mobile</p>
                  <p className="font-mono font-semibold text-gray-800 mt-0.5">
                    {selectedPatient.phone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Age / Gender</p>
                  <p className="font-semibold text-gray-800 mt-0.5">
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
                  <p className="text-gray-500">Alternative No</p>
                  <p className="font-mono text-gray-700 mt-0.5">
                    {selectedPatient.alternatePhone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Relation Name</p>
                  <p className="text-gray-800 font-medium mt-0.5">
                    {(selectedPatient.emergencyContact as any)?.name || '—'}
                  </p>
                </div>
              </div>

              {/* OP Consultations Table */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  Recent OP Visits
                </h3>
                {(!selectedPatient.opCases || selectedPatient.opCases.length === 0) ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded">
                    No OP consultations recorded.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                        <tr>
                          <th className="px-3 py-2">Visit Date</th>
                          <th className="px-3 py-2">Doctor / Provider</th>
                          <th className="px-3 py-2">Chief Complaint</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedPatient.opCases.map((op) => (
                          <tr key={op.id}>
                            <td className="px-3 py-2 font-mono whitespace-nowrap">{when(op.createdAt)}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{op.provider?.name || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{op.chiefComplaint || '—'}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                                {op.status || 'OP Consultation'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Invoices & Payments Table */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Recent Invoices & Bills
                </h3>
                {(!selectedPatient.invoices || selectedPatient.invoices.length === 0) ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded">
                    No invoices recorded for this patient.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                        <tr>
                          <th className="px-3 py-2">Invoice #</th>
                          <th className="px-3 py-2">Issue Date</th>
                          <th className="px-3 py-2 text-right">Grand Total</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedPatient.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="px-3 py-2 font-mono font-medium text-gray-900">
                              {inv.invoiceNumber || '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{when(inv.issueDate)}</td>
                            <td className="px-3 py-2 font-bold text-right text-gray-900">
                              ₹{Number(inv.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                {inv.status || 'PAID'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Link
                                to={`/billing/${inv.id}`}
                                className="text-blue-600 hover:underline font-semibold"
                              >
                                View invoice &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="btn-secondary text-xs"
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
