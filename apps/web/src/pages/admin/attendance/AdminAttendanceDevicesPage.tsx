import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Smartphone, Globe, Fingerprint,
  Search, ShieldX, CheckCircle2, Clock,
} from 'lucide-react';
import { attendanceApi } from '../../../services/attendance';

function relativeTime(iso?: string | null) {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function PlatformIcon({ platform }: { platform?: string }) {
  const p = (platform || '').toLowerCase();
  if (p.includes('ios') || p.includes('iphone')) return <Smartphone className="h-3.5 w-3.5 text-slate-500" />;
  if (p.includes('android'))                       return <Smartphone className="h-3.5 w-3.5 text-emerald-600" />;
  return <Globe className="h-3.5 w-3.5 text-blue-500" />;
}

function PlatformBadge({ platform }: { platform?: string }) {
  const p = (platform || 'Web').toLowerCase();
  const label = p.includes('ios') ? 'iOS' : p.includes('android') ? 'Android' : 'Web';
  const cls = p.includes('ios')
    ? 'bg-slate-100 text-slate-700'
    : p.includes('android')
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-blue-50 text-blue-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <PlatformIcon platform={platform} />
      {label}
    </span>
  );
}

export function AdminAttendanceDevicesPage() {
  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [msg, setMsg]       = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () =>
    attendanceApi
      .listDevices()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke device for ${name}? They must register again.`)) return;
    setRevoking(id);
    setError(null);
    try {
      await attendanceApi.revokeDevice(id);
      setMsg('Device revoked.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  };

  const filtered = search
    ? rows.filter((r) =>
        (r.user?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.user?.email || '').toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const activeCount  = rows.filter((r) => r.isActive).length;
  const revokedCount = rows.filter((r) => !r.isActive).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/admin/attendance" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Attendance devices</h1>
          <p className="text-sm text-[var(--muted)]">Registered staff devices for check-in</p>
        </div>
      </div>

      {msg   && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{msg}</div>}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
            <p className="text-xs text-[var(--muted)]">Active devices</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-400">{revokedCount}</p>
            <p className="text-xs text-[var(--muted)]">Revoked</p>
          </div>
          <div className="card p-4 text-center sm:block hidden">
            <p className="text-2xl font-bold">{rows.length}</p>
            <p className="text-xs text-[var(--muted)]">Total registered</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          className="input pl-9 max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Platform</th>
                <th className="px-4 py-2.5">Device</th>
                <th className="px-4 py-2.5">Biometric</th>
                <th className="px-4 py-2.5">Registered</th>
                <th className="px-4 py-2.5">Last used</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user?.name}</p>
                    <p className="text-xs text-[var(--muted)]">{r.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={r.platform} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[160px] truncate text-xs text-[var(--muted)]" title={r.deviceName}>
                      {r.deviceName ? r.deviceName.slice(0, 40) + (r.deviceName.length > 40 ? '…' : '') : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.webauthnCredentialId ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <Fingerprint className="h-3.5 w-3.5" /> Enrolled
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.registeredAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {relativeTime(r.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {r.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        <ShieldX className="h-3 w-3" /> Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.isActive && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        disabled={revoking === r.id}
                        onClick={() => revoke(r.id, r.user?.name || 'this user')}
                      >
                        {revoking === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldX className="h-3 w-3" />}
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">
                    {search ? 'No devices match your search.' : 'No devices registered.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
