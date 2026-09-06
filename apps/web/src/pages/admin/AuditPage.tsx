import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { auditApi, type AuditLog } from '../../services/admin';

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [topActions, setTopActions] = useState<Array<{ action: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, stats] = await Promise.all([
        auditApi.list({ page, action: action || undefined, entityType: entityType || undefined }),
        auditApi.stats(),
      ]);
      setLogs(list.data);
      setTotal(list.meta.total);
      setTopActions(stats.topActions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-gray-500">{total} events recorded</p>
      </div>

      {topActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topActions.slice(0, 8).map((item) => (
            <button
              key={item.action}
              className={`px-3 py-1 rounded-full text-xs ${action === item.action ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              onClick={() => { setAction(item.action === action ? '' : item.action); setPage(1); }}
            >
              {item.action} ({item.count})
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input className="input" placeholder="Action (e.g. INVOICE_CREATED)" value={action} onChange={(e) => setAction(e.target.value)} />
        <input className="input" placeholder="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <button className="btn-primary" onClick={() => { setPage(1); load(); }}>Filter</button>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-3 whitespace-nowrap text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-3">{log.actor?.name || log.actor?.email || 'System'}</td>
                  <td className="p-3 font-medium">{log.action}</td>
                  <td className="p-3">{[log.entityType, log.entityId].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="p-3">{log.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <button className="btn-secondary" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
