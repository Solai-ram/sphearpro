import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  User,
  Phone,
  Clock,
  X,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { ageFromDob, formatAddress } from '../../lib/age';

type PatientHistory = {
  id: string;
  patientNumber: string;
  name: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: Record<string, string>;
  createdAt: string;
  opCases?: Array<{
    id: string;
    createdAt: string;
    status?: string;
    chiefComplaint?: string;
    provider?: { name?: string };
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber?: string;
    issueDate: string;
    grandTotal?: number;
    status?: string;
  }>;
  timelineEvents?: Array<{
    id: string;
    eventType: string;
    title: string;
    description?: string;
    occurredAt: string;
  }>;
};

function when(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-IN')} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function PatientSearchPage() {
  const [query, setQuery] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchHit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const loadPatientDetail = async (patientId: string) => {
    setDetailLoading(true);
    try {
      const full = await patientsApi.getById<PatientHistory>(patientId);
      setSelectedPatient(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient records');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q && !visitDate) {
      setError('Enter a patient ID, name, phone number, or select a visit date');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedPatient(null);
    setHasSearched(true);

    try {
      // 1. If query matches a single patient number exactly, check getByNumber
      if (q && !visitDate && /^P\d{4,}$/i.test(q)) {
        try {
          const direct = await patientsApi.getByNumber<PatientHistory>(q);
          if (direct) {
            setSelectedPatient(direct);
            setSearchResults([]);
            return;
          }
        } catch {
          // fallback to general search
        }
      }

      // 2. Perform general search across name, phone, patientNumber, email, visitDate
      const hits = await patientsApi.search(q, 30, {
        visitDate: visitDate || undefined,
      });

      setSearchResults(hits);

      if (hits.length === 0) {
        setError('No patients found matching the criteria.');
      } else if (hits.length === 1) {
        // Auto-load details if only 1 patient found
        await loadPatientDetail(hits[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setVisitDate('');
    setSearchResults([]);
    setSelectedPatient(null);
    setError(null);
    setHasSearched(false);
  };

  const age = ageFromDob(selectedPatient?.dateOfBirth);
  const records = !selectedPatient
    ? []
    : [
        ...(selectedPatient.opCases || []).map((item) => ({
          key: `op-${item.id}`,
          kind: 'OP visit',
          at: item.createdAt,
          title: item.provider?.name ? `Doctor: ${item.provider.name}` : 'OP consultation',
          detail: item.chiefComplaint || item.status || '',
          href: `/patients/${selectedPatient.id}`,
        })),
        ...(selectedPatient.invoices || []).map((item) => ({
          key: `inv-${item.id}`,
          kind: 'Invoice',
          at: item.issueDate,
          title: item.invoiceNumber || 'Invoice',
          detail: item.status || (item.grandTotal ? `₹${item.grandTotal}` : ''),
          href: `/billing/${item.id}`,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Patient search</h1>
        <p className="text-sm text-gray-500">
          Search by patient ID, name, phone number, or date of visit to view previous clinical and billing records.
        </p>
      </div>

      {/* Advanced Search Form */}
      <form onSubmit={handleSearch} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Text Search: Name / Phone / Patient ID */}
          <div className="md:col-span-7 relative">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Patient ID, Name, or Phone
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input h-10 pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. P000001, Priya Sharma, 9876543210..."
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Date of Visit Filter */}
          <div className="md:col-span-3">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Date of visit
              </label>
              {visitDate && (
                <button
                  type="button"
                  onClick={() => setVisitDate('')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear date
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="date"
                className="input h-10"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-2 flex items-end gap-2">
            <button
              type="submit"
              className="btn-primary h-10 flex-1 justify-center"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
            {(query || visitDate || hasSearched) && (
              <button
                type="button"
                onClick={handleClear}
                title="Reset all search fields"
                className="btn-secondary h-10 px-2.5"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-gray-500">
          <span className="font-medium text-gray-600">Quick search tips:</span>
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Patient ID (P000001)</span>
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Mobile number (9840...)</span>
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Full or partial patient name</span>
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Filter by exact visit date</span>
        </div>
      </form>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Multiple Matching Patients List */}
      {searchResults.length > 1 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 text-sm">
              Found {searchResults.length} matching patients
            </h3>
            <span className="text-xs text-gray-500">Click any patient to view visit records</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {searchResults.map((p) => {
              const pAge = ageFromDob(p.dateOfBirth);
              const latestVisit = p.opCases?.[0]?.createdAt;
              const isSelected = selectedPatient?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => loadPatientDetail(p.id)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                        <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {p.patientNumber}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-1">
                        {p.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {p.phone}
                          </span>
                        )}
                        {pAge != null && <span>· {pAge} yrs</span>}
                        {p.gender && p.gender !== 'UNKNOWN' && <span>· {p.gender}</span>}
                        {latestVisit && (
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-medium">
                            Latest visit: {new Date(latestVisit).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadPatientDetail(p.id);
                      }}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {isSelected ? 'Viewing records' : 'View records'}
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="card p-10 flex flex-col items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-sm">Loading patient records…</p>
        </div>
      )}

      {/* Selected Patient Details Card & Records */}
      {selectedPatient && !detailLoading && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  {selectedPatient.patientNumber}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">{selectedPatient.name}</h2>
                <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                  {age != null && <span>{age} years</span>}
                  {selectedPatient.gender && selectedPatient.gender !== 'UNKNOWN' && (
                    <span>· {selectedPatient.gender}</span>
                  )}
                  {selectedPatient.phone && (
                    <span className="flex items-center gap-1 font-mono text-gray-700">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {selectedPatient.phone}
                    </span>
                  )}
                  {selectedPatient.email && <span>· {selectedPatient.email}</span>}
                </p>
                {formatAddress(selectedPatient.address) && (
                  <p className="text-sm text-gray-500 mt-1">{formatAddress(selectedPatient.address)}</p>
                )}
              </div>
              <Link to={`/patients/${selectedPatient.id}`} className="btn-secondary">
                <User className="w-4 h-4 mr-2" />
                Full patient profile
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
              <div className="rounded-lg bg-gray-50 px-3.5 py-2.5">
                <p className="text-xs text-gray-500">OP visits</p>
                <p className="text-lg font-bold text-gray-900">{selectedPatient.opCases?.length || 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3.5 py-2.5">
                <p className="text-xs text-gray-500">Invoices</p>
                <p className="text-lg font-bold text-gray-900">{selectedPatient.invoices?.length || 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3.5 py-2.5 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500">First registered</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {new Date(selectedPatient.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Previous records & visit history</h3>
              </div>
              <span className="text-xs text-gray-500">{records.length} records found</span>
            </div>

            {records.length === 0 ? (
              <p className="px-5 py-10 text-center text-gray-500">
                No previous visits or invoices recorded for this patient.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                    <tr>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">Status / Summary</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((row) => (
                      <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-gray-700">
                          {when(row.at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              row.kind === 'OP visit'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {row.kind}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.title}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {row.detail || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={row.href}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Open record &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedPatient && !error && !isLoading && !hasSearched && (
        <div className="card p-8 text-center text-gray-500 space-y-2">
          <Search className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="font-medium text-gray-700 text-sm">Search across all registered patients</p>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            You can search by Patient ID, patient full/partial name, phone number, or pick a visit date to inspect that day's clinic visits.
          </p>
        </div>
      )}
    </div>
  );
}
