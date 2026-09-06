import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Plus, Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import type { TherapyCase, TherapyFilters } from '../../types/therapy';
import { useAuth } from '../../auth/AuthContext';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-info',
  COMPLETED: 'badge-success',
  DISCONTINUED: 'badge-gray',
};

export function TherapyCasesListPage() {
  const { user } = useAuth();
  const isDoctorOnly = user?.staffType === 'DOCTOR' && !(user.roles || []).includes('ADMIN');

  const [cases, setCases] = useState<TherapyCase[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<TherapyFilters>({ page: 1, limit: 20, search: '', status: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDoctorOnly) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await therapyApi.getCases(filters);
        setCases(result.data);
        setMeta(result.meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load therapy cases');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [filters, isDoctorOnly]);

  if (isDoctorOnly) {
    return <Navigate to="/doctor/sessions" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Therapy cases</h1>
          <p className="text-gray-500">Registered therapy cases after an OP consultation</p>
        </div>
        <div className="flex gap-2">
          <Link to="/therapy/packages" className="btn-secondary">Packages</Link>
          <Link to="/therapy/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Therapy registration
          </Link>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search by patient or case title..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>
        <select
          className="input"
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    No therapy cases yet
                  </td>
                </tr>
              ) : cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-medium">{c.patient?.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{c.patient?.patientNumber}</p>
                  </td>
                  <td className="px-4 py-4">{c.title}</td>
                  <td className="px-4 py-4 text-sm">{c.therapist?.name}</td>
                  <td className="px-4 py-4 text-sm">{c._count?.sessions ?? 0}</td>
                  <td className="px-4 py-4"><span className={STATUS_BADGE[c.status]}>{c.status}</span></td>
                  <td className="px-4 py-4">
                    <Link to={`/therapy/${c.id}`} className="text-blue-600 text-sm font-medium">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <span className="text-sm text-gray-600">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" disabled={meta.page === 1} onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" className="btn-secondary" disabled={meta.page === meta.totalPages} onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
