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
  alternatePhone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: Record<string, any>;
  emergencyContact?: Record<string, any>;
  createdAt?: string;
  opCases?: {
    id: string;
    createdAt: string;
    chiefComplaint?: string | null;
    status?: string;
    provider?: { id: string; name: string };
  }[];
  appointments?: {
    id: string;
    startTime: string;
    provider?: { id: string; name: string };
  }[];
  invoices?: { id: string; invoiceNumber?: string; issueDate: string; grandTotal?: number; status?: string }[];
};

export type AdvancedSearchFilters = {
  opRegistered?: boolean;
  visitDate?: string;
  name?: string;
  regNo?: string;
  phone?: string;
  gender?: string;
  dateFrom?: string;
  dateTo?: string;
  matchMode?: 'startsWith' | 'contains';
  doctorId?: string;
  address?: string;
  relationName?: string;
  visitType?: 'OP' | 'THERAPY' | 'ALL';
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

  search(q = '', limit = 50, options?: AdvancedSearchFilters) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('limit', String(limit));
    if (options) {
      if (options.opRegistered) params.set('opRegistered', 'true');
      if (options.visitDate) params.set('visitDate', options.visitDate);
      if (options.name) params.set('name', options.name);
      if (options.regNo) params.set('regNo', options.regNo);
      if (options.phone) params.set('phone', options.phone);
      if (options.gender) params.set('gender', options.gender);
      if (options.dateFrom) params.set('dateFrom', options.dateFrom);
      if (options.dateTo) params.set('dateTo', options.dateTo);
      if (options.matchMode) params.set('matchMode', options.matchMode);
      if (options.doctorId) params.set('doctorId', options.doctorId);
      if (options.address) params.set('address', options.address);
      if (options.relationName) params.set('relationName', options.relationName);
      if (options.visitType) params.set('visitType', options.visitType);
    }
    return fetchApi<PatientSearchHit[] | { data: PatientSearchHit[] }>(
      `/patients/search?${params.toString()}`,
    ).then((res) => (Array.isArray(res) ? res : res.data || []));
  },
};
