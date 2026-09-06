import { fetchApi } from '../lib/api';

export type PatientPayload = {
  name: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: Record<string, string | undefined>;
  emergencyContact?: Record<string, string | undefined>;
};

export type PatientSearchHit = {
  id: string;
  name: string;
  patientNumber: string;
  phone?: string;
  opCases?: { id: string; createdAt: string; chiefComplaint?: string | null; status?: string }[];
};

export const patientsApi = {
  create(data: PatientPayload) {
    return fetchApi<{ id: string } & PatientPayload>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getById<T = Record<string, unknown>>(id: string) {
    return fetchApi<T>(`/patients/${id}`);
  },

  getByNumber<T = Record<string, unknown>>(patientNumber: string) {
    return fetchApi<T>(`/patients/number/${encodeURIComponent(patientNumber)}`);
  },

  getTimeline(id: string, limit = 50) {
    return fetchApi<{ data?: Array<{
      id: string;
      eventType: string;
      title: string;
      description?: string;
      occurredAt: string;
    }>; } | Array<{
      id: string;
      eventType: string;
      title: string;
      description?: string;
      occurredAt: string;
    }>>(`/patients/${id}/timeline?limit=${limit}`);
  },

  update(id: string, data: PatientPayload) {
    return fetchApi(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  search(q: string, limit = 10, options?: { opRegistered?: boolean }) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (options?.opRegistered) params.set('opRegistered', 'true');
    return fetchApi<PatientSearchHit[] | { data: PatientSearchHit[] }>(
      `/patients/search?${params.toString()}`,
    ).then((res) => (Array.isArray(res) ? res : res.data || []));
  },
};
