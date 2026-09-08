import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, FlaskConical, Loader2, Plus } from 'lucide-react';
import { labApi } from '../../services/lab';
import type { LabDashboard, LabExecutedPeriod } from '../../types/lab';

function rupees(value?: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyPeriod(): LabExecutedPeriod {
  return { tests: 0, invoices: 0, revenue: 0 };
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LabDashboardPage() {
  const [data, setData] = useState<LabDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    labApi.getDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audio dashboard'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const executed = {
    today: data?.executed?.today || emptyPeriod(),
    week: data?.executed?.week || emptyPeriod(),
    month: data?.executed?.month || emptyPeriod(),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Audio dashboard</h1>
          <p className="text-sm text-gray-500">Tests billed today, this week, and this month.</p>
        </div>
        <Link to="/lab/procedures/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-1" /> New procedure
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { key: 'today', label: 'Executed today', hint: 'Invoices dated today', color: 'bg-sky-600', data: executed.today },
          { key: 'week', label: 'Executed this week', hint: 'Last 7 days', color: 'bg-indigo-600', data: executed.week },
          { key: 'month', label: 'Executed this month', hint: 'Calendar month', color: 'bg-emerald-600', data: executed.month },
        ].map((card) => (
          <div key={card.key} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold leading-tight mt-1">{card.data.tests}</p>
                <p className="text-sm text-gray-600 mt-1">{rupees(card.data.revenue)} billed</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.data.invoices} invoice line{card.data.invoices === 1 ? '' : 's'} · {card.hint}</p>
              </div>
              <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}>
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Catalog tests', value: data?.total || 0, color: 'bg-sky-500' },
          { label: 'Active', value: data?.active || 0, color: 'bg-emerald-500' },
          { label: 'Inactive', value: data?.inactive || 0, color: 'bg-slate-400' },
          { label: 'Departments', value: data?.byDepartment.length || 0, color: 'bg-indigo-500' },
        ].map((card) => (
          <div key={card.label} className="card p-3 flex items-center gap-3">
            <div className={`${card.color} w-9 h-9 rounded-lg flex items-center justify-center`}>
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b text-sm font-semibold">This month — by department</div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {(data?.executedByDepartment || []).map((row) => (
                <tr key={row.department}>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2 text-right font-medium">{row.tests} tests</td>
                </tr>
              ))}
              {(data?.executedByDepartment || []).length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={2}>No audio tests billed this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b text-sm font-semibold">This month — top procedures</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Billed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.topProcedures || []).map((row) => (
                <tr key={row.name}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-gray-500">{row.department}</p>
                  </td>
                  <td className="px-3 py-2 text-right">{row.tests}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{rupees(row.revenue)}</td>
                </tr>
              ))}
              {(data?.topProcedures || []).length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No billed procedures this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">Recently billed audio tests</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.recentBilled || []).map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.issueDate)}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{row.patientName || '—'}</p>
                  <p className="text-xs text-gray-500">{row.patientNumber}</p>
                </td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                <td className="px-3 py-2 text-right">{row.quantity}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{rupees(row.lineTotal)}</td>
              </tr>
            ))}
            {(data?.recentBilled || []).length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>No audio tests on invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
