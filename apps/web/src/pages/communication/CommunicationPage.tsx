import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { communicationApi, type CommunicationMessage } from '../../services/communication';

const STATUS_BADGE: Record<string, string> = {
  QUEUED: 'badge-info',
  SENT: 'badge-info',
  DELIVERED: 'badge-success',
  READ: 'badge-success',
  FAILED: 'badge-danger',
};

export function CommunicationPage() {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [metrics, setMetrics] = useState<{ waiting: number; active: number; completed: number; failed: number } | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, queue] = await Promise.all([
        communicationApi.getMessages({ status: status || undefined }),
        communicationApi.getMetrics().catch(() => null),
      ]);
      setMessages(list.data);
      setMetrics(queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communication</h1>
          <p className="text-gray-500">WhatsApp reminders, invoices, and receipts</p>
        </div>
        <button className="btn-secondary" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</button>
      </div>

      {metrics && (
        <div className="grid grid-cols-4 gap-4">
          {(['waiting', 'active', 'completed', 'failed'] as const).map((key) => (
            <div key={key} className="card p-4">
              <p className="text-sm text-gray-500 capitalize">{key}</p>
              <p className="text-xl font-semibold">{metrics[key]}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <div className="flex gap-2">
        {['', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'].map((value) => (
          <button key={value || 'all'} className={status === value ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatus(value)}>
            {value || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(m.createdAt).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{m.patient?.name || '—'}</td>
                  <td className="px-4 py-3">{m.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 font-mono">{m.to}</td>
                  <td className="px-4 py-3"><span className={STATUS_BADGE[m.status] || 'badge-gray'}>{m.status}</span></td>
                  <td className="px-4 py-3 max-w-md whitespace-pre-wrap">{m.content}</td>
                  <td className="px-4 py-3">
                    {m.status === 'FAILED' && (
                      <button className="btn-ghost text-blue-600" onClick={async () => { await communicationApi.resend(m.id); await load(); }}>Resend</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {messages.length === 0 && <div className="p-8 text-center text-gray-500">No messages yet. Create an invoice or trigger a clinic event to queue WhatsApp.</div>}
        </div>
      )}
    </div>
  );
}
