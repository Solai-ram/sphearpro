import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Plus } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import type { TherapyPackage, TherapyType, SessionFrequency } from '../../types/therapy';

const FREQUENCIES: SessionFrequency[] = [
  'WEEKLY', 'TWICE_WEEKLY', 'THREE_TIMES_WEEKLY', 'DAILY', 'EVERY_TWO_WEEKS', 'MONTHLY', 'CUSTOM',
];

export function TherapyPackagesPage() {
  const [packages, setPackages] = useState<TherapyPackage[]>([]);
  const [types, setTypes] = useState<TherapyType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    therapyTypeId: '',
    name: '',
    totalSessions: 12,
    frequency: 'WEEKLY' as SessionFrequency,
    price: 10000,
    validityDays: 90,
  });

  const load = async () => {
    setIsLoading(true);
    try {
      const [pkg, typeList] = await Promise.all([therapyApi.getPackages(), therapyApi.getTypes()]);
      setPackages(pkg.data);
      setTypes(typeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await therapyApi.createPackage(form);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/therapy" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-2xl font-bold">Therapy Packages</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> New Package
        </button>
      </div>
      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className="input" value={form.therapyTypeId} onChange={(e) => setForm({ ...form, therapyTypeId: e.target.value })} required>
            <option value="">Therapy type</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="input" placeholder="Package name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="number" min={1} value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: Number(e.target.value) })} />
          <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as SessionFrequency })}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="input" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          <input className="input" type="number" min={1} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
          <div className="md:col-span-3 flex justify-end">
            <button className="btn-primary" type="submit">Save package</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {packages.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm">{p.therapyType?.name}</td>
                  <td className="px-4 py-3 text-sm">{p.totalSessions}</td>
                  <td className="px-4 py-3 text-sm">{p.frequency.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-sm">₹{Number(p.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
