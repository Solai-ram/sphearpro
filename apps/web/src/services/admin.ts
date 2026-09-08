import { fetchApi, getAccessToken, API_BASE } from '../lib/api';

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  rolePermissions?: Array<{ permissionId: string; permission: Permission }>;
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  mobile?: string | null;
  status: string;
  staffType?: string | null;
  lastLoginAt?: string | null;
  roles?: Array<{ roleId: string; role: Role }>;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  patientId?: string | null;
  result?: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
  metadata?: Record<string, unknown> | null;
}

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  group: string;
}

export const usersApi = {
  list(params?: { page?: number; limit?: number; search?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    return fetchApi<{ data: AdminUser[]; meta: { total: number; page: number; totalPages: number } }>(`/users?${q.toString()}`);
  },
  create(body: { email: string; password: string; name: string; username?: string; mobile?: string; staffType?: string; roleIds?: string[] }) {
    return fetchApi<AdminUser>('/users', { method: 'POST', body: JSON.stringify(body) });
  },
  update(id: string, body: Partial<Pick<AdminUser, 'name' | 'mobile' | 'email' | 'username' | 'staffType' | 'status'>>) {
    return fetchApi<AdminUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  disable(id: string) {
    return fetchApi<{ message: string }>(`/users/${id}`, { method: 'DELETE' });
  },
  assignRoles(id: string, roleIds: string[]) {
    return fetchApi<AdminUser>(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ roleIds }) });
  },
};

export const rolesApi = {
  list() {
    return fetchApi<{ data: Role[] }>('/roles?limit=100');
  },
  create(body: { name: string; description?: string }) {
    return fetchApi<Role>('/roles', { method: 'POST', body: JSON.stringify(body) });
  },
  assignPermissions(id: string, permissionIds: string[]) {
    return fetchApi<Role>(`/roles/${id}/permissions`, { method: 'POST', body: JSON.stringify({ permissionIds }) });
  },
};

export const permissionsApi = {
  list() {
    return fetchApi<{ data: Permission[] }>('/permissions?limit=200');
  },
};

export const auditApi = {
  list(params?: { page?: number; action?: string; entityType?: string }) {
    const q = new URLSearchParams();
    q.set('page', String(params?.page || 1));
    q.set('limit', '50');
    if (params?.action) q.set('action', params.action);
    if (params?.entityType) q.set('entityType', params.entityType);
    return fetchApi<{ data: AuditLog[]; meta: { total: number; page: number; totalPages: number } }>(`/audit?${q.toString()}`);
  },
  stats() {
    return fetchApi<{ total: number; topActions: Array<{ action: string; count: number }> }>('/audit/stats');
  },
};

export const settingsApi = {
  list() {
    return fetchApi<Setting[]>('/settings');
  },
  save(items: Array<{ key: string; value: unknown; group?: string }>) {
    return fetchApi<Setting[]>('/settings', { method: 'PATCH', body: JSON.stringify({ items }) });
  },
  getLogo() {
    return fetchApi<{ url: string | null; fileName: string; mimeType: string }>('/settings/logo');
  },
  async uploadLogo(file: File) {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_BASE}/settings/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      body: form,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Logo upload failed');
    }
    return response.json() as Promise<{ url: string | null; fileName: string; mimeType: string }>;
  },
  removeLogo() {
    return fetchApi<{ url: string | null; fileName: string; mimeType: string }>('/settings/logo', {
      method: 'DELETE',
    });
  },
};
