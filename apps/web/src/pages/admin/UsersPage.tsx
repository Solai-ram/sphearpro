import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Plus, Search, UserX } from 'lucide-react';
import { rolesApi, usersApi, type AdminUser, type Role } from '../../services/admin';

const STAFF_TYPES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING', 'INVENTORY', 'OTHER'];

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    staffType: 'RECEPTIONIST',
    roleIds: [] as string[],
  });
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [userRes, roleRes] = await Promise.all([
        usersApi.list({ search, limit: 50 }),
        rolesApi.list(),
      ]);
      setUsers(userRes.data);
      setRoles(roleRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await usersApi.create(form);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', mobile: '', staffType: 'RECEPTIONIST', roleIds: [] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const saveRoles = async (userId: string) => {
    setError(null);
    try {
      await usersApi.assignRoles(userId, selectedRoleIds);
      setEditingRoles(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign roles');
    }
  };

  const disableUser = async (user: AdminUser) => {
    if (!confirm(`Disable ${user.name}? They will not be able to sign in.`)) return;
    try {
      await usersApi.disable(user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500">Staff accounts, roles, and access</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New user
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={load}>Search</button>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      {showForm && (
        <form className="card p-4 grid gap-3 md:grid-cols-2" onSubmit={createUser}>
          <input className="input" required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" required type="password" minLength={8} placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <select
            className="input"
            value={form.staffType}
            onChange={(e) => {
              const staffType = e.target.value;
              const match = roles.find((role) => role.name === staffType);
              setForm({
                ...form,
                staffType,
                roleIds: match ? [match.id] : form.roleIds,
              });
            }}
          >
            {STAFF_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select className="input" multiple value={form.roleIds} onChange={(e) => setForm({ ...form, roleIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <div className="md:col-span-2 flex gap-2">
            <button className="btn-primary" type="submit">Create</button>
            <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Staff</th>
                <th className="p-3">Roles</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-gray-600">{user.email}</td>
                  <td className="p-3">{user.staffType || '—'}</td>
                  <td className="p-3">
                    {editingRoles === user.id ? (
                      <div className="space-y-2">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedRoleIds.includes(role.id)}
                              onChange={(e) => setSelectedRoleIds((ids) => e.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))}
                            />
                            {role.name}
                          </label>
                        ))}
                        <div className="flex gap-2">
                          <button className="btn-primary text-xs" type="button" onClick={() => saveRoles(user.id)}>Save</button>
                          <button className="btn-secondary text-xs" type="button" onClick={() => setEditingRoles(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="text-blue-700"
                        onClick={() => {
                          setEditingRoles(user.id);
                          setSelectedRoleIds(user.roles?.map((r) => r.roleId || r.role.id) || []);
                        }}
                      >
                        {user.roles?.map((r) => r.role.name).join(', ') || 'Assign roles'}
                      </button>
                    )}
                  </td>
                  <td className="p-3">{user.status}</td>
                  <td className="p-3 text-right">
                    {user.status === 'ACTIVE' && (
                      <button className="text-red-600 inline-flex items-center gap-1" onClick={() => disableUser(user)}>
                        <UserX className="w-4 h-4" /> Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
