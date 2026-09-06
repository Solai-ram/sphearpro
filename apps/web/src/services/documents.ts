import { fetchApi, getAccessToken, API_BASE } from '../lib/api';

export interface PatientDocument {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  patientId: string;
  patient?: { id: string; name: string; patientNumber: string };
  uploadedBy?: { id: string; name: string } | null;
}

export const documentsApi = {
  list(params?: { page?: number; search?: string; category?: string; patientId?: string }) {
    const q = new URLSearchParams();
    q.set('page', String(params?.page || 1));
    q.set('limit', '30');
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.patientId) q.set('patientId', params.patientId);
    return fetchApi<{ data: PatientDocument[]; meta: { total: number; page: number; totalPages: number } }>(`/documents?${q.toString()}`);
  },
  listByPatient(patientId: string) {
    return fetchApi<{ data: PatientDocument[] }>(`/documents/patients/${patientId}`);
  },
  categories() {
    return fetchApi<Array<{ value: string; label: string }>>('/documents/categories');
  },
  async upload(patientId: string, file: File, category: string) {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    const response = await fetch(`${API_BASE}/documents/patients/${patientId}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      body: form,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }
    return response.json() as Promise<PatientDocument>;
  },
  async download(id: string) {
    const result = await fetchApi<{ url: string; fileName: string }>(`/documents/${id}/download`);
    let parsed: URL;
    try {
      parsed = new URL(result.url);
    } catch {
      throw new Error('Invalid download URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Download URL scheme not allowed');
    }
    window.open(result.url, '_blank', 'noopener');
  },
  remove(id: string) {
    return fetchApi<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' });
  },
};
