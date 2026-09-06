import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, AlertCircle, User, Phone, Clock } from 'lucide-react';
import { patientsApi } from '../../services/patients';
import { ageFromDob, formatAddress } from '../../lib/age';

type PatientHistory = {
  id: string;
  patientNumber: string;
  name: string;
  phone?: string;
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
  const [patient, setPatient] = useState<PatientHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = query.trim();
    if (!id) {
      setError('Enter a patient ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPatient(null);
    try {
      try {
        setPatient(await patientsApi.getByNumber<PatientHistory>(id));
        return;
      } catch {
        const hits = await patientsApi.search(id, 8);
        const exact = hits.find((hit) => hit.patientNumber.toLowerCase() === id.toLowerCase()) || hits[0];
        if (!exact) throw new Error('No patient found for this ID');
        setPatient(await patientsApi.getById<PatientHistory>(exact.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patient not found');
    } finally {
      setIsLoading(false);
    }
  };

  const age = ageFromDob(patient?.dateOfBirth);
  const records = [
    ...(patient?.opCases || []).map((item) => ({
      key: `op-${item.id}`,
      kind: 'OP visit',
      at: item.createdAt,
      title: item.provider?.name ? `Doctor: ${item.provider.name}` : 'OP consultation',
      detail: item.chiefComplaint || item.status || '',
      href: `/patients/${patient.id}`,
    })),
    ...(patient?.invoices || []).map((item) => ({
      key: `inv-${item.id}`,
      kind: 'Invoice',
      at: item.issueDate,
      title: item.invoiceNumber || 'Invoice',
      detail: item.status || '',
      href: `/billing/${item.id}`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Patient search</h1>
        <p className="text-sm text-gray-500">Search by patient ID to view previous records</p>
      </div>

      <form onSubmit={search} className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input h-10 pl-9 font-mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter patient ID, e.g. P000020"
            autoFocus
          />
        </div>
        <button type="submit" className="btn-primary h-10" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {patient && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-blue-700">{patient.patientNumber}</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">{patient.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {[
                    age != null ? `${age} years` : null,
                    patient.gender && patient.gender !== 'UNKNOWN' ? patient.gender : null,
                    patient.phone,
                  ].filter(Boolean).join(' · ')}
                </p>
                {formatAddress(patient.address) && (
                  <p className="text-sm text-gray-500 mt-1">{formatAddress(patient.address)}</p>
                )}
              </div>
              <Link to={`/patients/${patient.id}`} className="btn-secondary">
                <User className="w-4 h-4 mr-2" />
                Full profile
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">OP visits</p>
                <p className="text-lg font-semibold">{patient.opCases?.length || 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Invoices</p>
                <p className="text-lg font-semibold">{patient.invoices?.length || 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Registered</p>
                <p className="text-sm font-semibold">{new Date(patient.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Previous records</h3>
            </div>
            {records.length === 0 ? (
              <p className="px-5 py-10 text-center text-gray-500">No previous visits or records for this patient.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm whitespace-nowrap">{when(row.at)}</td>
                      <td className="px-5 py-3 text-sm font-medium">{row.kind}</td>
                      <td className="px-5 py-3 text-sm">
                        <Link to={row.href} className="text-blue-600 hover:text-blue-500">{row.title}</Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!patient && !error && !isLoading && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Type the patient ID from the registration receipt, then search.
        </p>
      )}
    </div>
  );
}
