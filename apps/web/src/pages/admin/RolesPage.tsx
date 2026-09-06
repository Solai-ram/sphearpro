import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { permissionsApi, rolesApi, type Permission, type Role } from '../../services/admin';

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });

  const selected = roles.find((r) => r.id === selectedId);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const list = map.get(permission.module) || [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const load = async (keepId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [roleRes, permRes] = await Promise.all([rolesApi.list(), permissionsApi.list()]);
      setRoles(roleRes.data);
      setPermissions(permRes.data);
      const nextId = keepId || selectedId || roleRes.data[0]?.id;
      setSelectedId(nextId || null);
      const role = roleRes.data.find((r) => r.id === nextId);
      setChecked(new Set(role?.rolePermissions?.map((rp) => rp.permissionId || rp.permission.id) || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectRole = (role: Role) => {
    setSelectedId(role.id);
    setChecked(new Set(role.rolePermissions?.map((rp) => rp.permissionId || rp.permission.id) || []));
  };

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!selected || selected.isSystem) return;
    setSaving(true);
    setError(null);
    try {
      await rolesApi.assignPermissions(selected.id, [...checked]);
      await load(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const role = await rolesApi.create(newRole);
      setNewRole({ name: '', description: '' });
      await load(role.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles & permissions</h1>
        <p className="text-gray-500">System roles are read-only. Create a custom role to change access.</p>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <form className="card p-4 flex flex-wrap gap-2 items-end" onSubmit={createRole}>
        <div>
          <label className="label">New custom role</label>
          <input className="input" required value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} placeholder="e.g. Senior Therapist" />
        </div>
        <input className="input" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} placeholder="Description" />
        <button className="btn-primary" type="submit"><Plus className="w-4 h-4 mr-1" /> Create</button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <div className="card p-2 space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                className={`w-full text-left px-3 py-2 rounded ${selectedId === role.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50'}`}
                onClick={() => selectRole(role)}
              >
                <div className="font-medium">{role.name}</div>
                {role.isSystem && <div className="text-xs text-gray-500">System</div>}
              </button>
            ))}
          </div>
          <div className="card p-4 space-y-4">
            {selected && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{selected.name}</h2>
                    <p className="text-sm text-gray-500">{selected.description || (selected.isSystem ? 'Built-in role — permissions cannot be edited' : 'Custom role')}</p>
                  </div>
                  {!selected.isSystem && (
                    <button className="btn-primary" disabled={saving} onClick={save}>
                      {saving ? 'Saving…' : 'Save permissions'}
                    </button>
                  )}
                </div>
                {grouped.map(([module, items]) => (
                  <div key={module}>
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-2">{module}</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {items.map((permission) => (
                        <label key={permission.id} className={`flex items-start gap-2 text-sm ${selected.isSystem ? 'opacity-70' : ''}`}>
                          <input
                            type="checkbox"
                            disabled={selected.isSystem}
                            checked={checked.has(permission.id)}
                            onChange={() => toggle(permission.id)}
                          />
                          <span>
                            <span className="font-medium">{permission.action}</span>
                            <span className="text-gray-500 block">{permission.name}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
