import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  Plus,
  Search,
  Shield,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { rolesApi, usersApi, type AdminUser, type Role } from '../../services/admin';
import { fetchApi } from '../../lib/api';
import type { ClinicSeatUsage } from '../subscription/types';

const STAFF_TYPES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING', 'INVENTORY', 'OTHER'] as const;

type CurrentSubscription = {
  seats?: ClinicSeatUsage;
};

function SeatMeter({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const over = used >= max;
  return (
    <div className="min-w-[140px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span className={over ? 'font-semibold text-amber-700' : 'font-medium text-[var(--text)]'}>
          {used}/{max}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-blue-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [seats, setSeats] = useState<ClinicSeatUsage | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const clinicRoles = useMemo(
    () => roles.filter((role) => role.name !== 'SUPER_ADMIN'),
    [roles],
  );

  const load = async (query = search) => {
    setIsLoading(true);
    setError(null);
    try {
      const [userRes, roleRes, subRes] = await Promise.all([
        usersApi.list({ search: query, limit: 50 }),
        rolesApi.list(),
        fetchApi<CurrentSubscription>('/subscription').catch(() => null),
      ]);
      setUsers(userRes.data);
      setRoles(roleRes.data);
      setSeats(subRes?.seats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const creatingAdmin = form.staffType === 'ADMIN';
  const seatsExhausted = seats
    ? creatingAdmin
      ? seats.remainingAdminUsers <= 0
      : seats.remainingStaffUsers <= 0
    : false;

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      mobile: '',
      staffType: 'RECEPTIONIST',
      roleIds: [],
    });
    setShowForm(false);
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (seatsExhausted) {
      setError(
        creatingAdmin
          ? `Your plan includes ${seats?.maxAdminUsers ?? 1} admin only. Upgrade your plan to add more admins.`
          : `Your plan includes ${seats?.maxStaffUsers ?? 10} users only. Upgrade your plan to add more users.`,
      );
      return;
    }
    setSaving(true);
    try {
      await usersApi.create(form);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
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

  const toggleRole = (roleId: string) => {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Users</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Staff accounts, roles, and access</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seats && (
            <>
              <SeatMeter label="Users" used={seats.usedStaffUsers} max={seats.maxStaffUsers} />
              <SeatMeter label="Admins" used={seats.usedAdminUsers} max={seats.maxAdminUsers} />
            </>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
            disabled={showForm}
          >
            <Plus className="mr-2 h-4 w-4" /> New user
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                load(search);
              }
            }}
          />
        </div>
        <button type="button" className="btn-secondary" onClick={() => load(search)}>
          Search
        </button>
      </div>

      {error && (
        <div className="flex flex-wrap items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{error}</p>
            {(error.toLowerCase().includes('upgrade your plan') ||
              error.toLowerCase().includes('seat')) && (
              <Link to="/subscription" className="mt-1 inline-block font-medium text-blue-700 underline">
                Upgrade your plan
              </Link>
            )}
          </div>
          <button type="button" className="text-red-500 hover:text-red-700" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showForm && (
        <form className="card overflow-hidden" onSubmit={createUser}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">New staff user</h2>
                <p className="text-xs text-[var(--muted)]">Credentials, staff type, and roles</p>
              </div>
            </div>
            <button type="button" className="btn-ghost p-2" onClick={resetForm} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            {seatsExhausted && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {creatingAdmin
                  ? `Your plan includes ${seats?.maxAdminUsers ?? 1} admin only. Upgrade your plan to add more admins.`
                  : `Your plan includes ${seats?.maxStaffUsers ?? 10} users only. Upgrade your plan to add more users.`}{' '}
                <Link to="/subscription" className="font-medium underline">
                  View subscription
                </Link>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="user-name">
                  Full name *
                </label>
                <input
                  id="user-name"
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-email">
                  Email *
                </label>
                <input
                  id="user-email"
                  className="input"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@clinic.com"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-password">
                  Password *
                </label>
                <input
                  id="user-password"
                  className="input"
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-mobile">
                  Mobile
                </label>
                <input
                  id="user-mobile"
                  className="input"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="+91 …"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-staff-type">
                  Staff type *
                </label>
                <select
                  id="user-staff-type"
                  className="input"
                  value={form.staffType}
                  onChange={(e) => {
                    const staffType = e.target.value;
                    const match = clinicRoles.find((role) => role.name === staffType);
                    setForm({
                      ...form,
                      staffType,
                      roleIds: match ? [match.id] : form.roleIds,
                    });
                  }}
                >
                  {STAFF_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-blue-600" />
                <label className="label mb-0">Roles</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {clinicRoles.map((role) => {
                  const selected = form.roleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-slate-300 hover:text-[var(--text)]'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
                {!clinicRoles.length && (
                  <p className="text-xs text-[var(--muted)]">No clinic roles available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-slate-50/80 px-4 py-3">
            <button className="btn-secondary" type="button" onClick={resetForm}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={seatsExhausted || saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </span>
              ) : (
                'Create user'
              )}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--border)] hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-[var(--text)]">{user.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {user.staffType || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingRoles === user.id ? (
                        <div className="max-w-xs space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {clinicRoles.map((role) => {
                              const checked = selectedRoleIds.includes(role.id);
                              return (
                                <label
                                  key={role.id}
                                  className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                                    checked
                                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                                      : 'border-[var(--border)] text-[var(--muted)]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={(e) =>
                                      setSelectedRoleIds((ids) =>
                                        e.target.checked
                                          ? [...ids, role.id]
                                          : ids.filter((id) => id !== role.id),
                                      )
                                    }
                                  />
                                  {role.name}
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-xs"
                              type="button"
                              onClick={() => saveRoles(user.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn-secondary text-xs"
                              type="button"
                              onClick={() => setEditingRoles(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-left text-blue-700 hover:underline"
                          onClick={() => {
                            setEditingRoles(user.id);
                            setSelectedRoleIds(user.roles?.map((r) => r.roleId || r.role.id) || []);
                          }}
                        >
                          {user.roles?.map((r) => r.role.name).join(', ') || 'Assign roles'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.status === 'ACTIVE' && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => disableUser(user)}
                        >
                          <UserX className="h-3.5 w-3.5" /> Disable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td className="px-4 py-12 text-center text-[var(--muted)]" colSpan={6}>
                      No users found. Create one with <span className="font-medium">New user</span>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
