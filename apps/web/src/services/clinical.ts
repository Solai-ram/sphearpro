import type {
  OpCase,
  OpCasesListResponse,
  CreateOpCaseInput,
  AddVisitInput,
  AddDiagnosisInput,
  AddClinicalNoteInput,
  AddPrescriptionInput,
  AddFollowUpInput,
  Icd10Code,
  ClinicalFilters,
  PatientOpCasesFilters,
} from '../types/clinical';
import { fetchApi } from '../lib/api';

export const clinicalApi = {
  // OP Cases
  async getAll(filters?: ClinicalFilters): Promise<OpCasesListResponse> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.providerId) params.append('providerId', filters.providerId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    return fetchApi<OpCasesListResponse>(`/clinical?${params.toString()}`);
  },

  async getByPatient(patientId: string, filters?: PatientOpCasesFilters): Promise<OpCasesListResponse> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.status) params.append('status', filters.status);

    return fetchApi<OpCasesListResponse>(`/clinical/patient/${patientId}?${params.toString()}`);
  },

  async getById(id: string): Promise<OpCase> {
    return fetchApi<OpCase>(`/clinical/${id}`);
  },

  async create(data: CreateOpCaseInput): Promise<OpCase> {
    return fetchApi<OpCase>('/clinical', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createReview(data: CreateOpCaseInput): Promise<OpCase> {
    return fetchApi<OpCase>('/clinical/review', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async invoice(id: string, unitPrice?: number): Promise<any> {
    return fetchApi(`/clinical/${id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ unitPrice }),
    });
  },

  async update(id: string, data: {
    chiefComplaint?: string;
    vitals?: Record<string, any>;
    status?: 'OPEN' | 'CLOSED';
  }): Promise<OpCase> {
    return fetchApi<OpCase>(`/clinical/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Visits
  async addVisit(opCaseId: string, data: AddVisitInput): Promise<any> {
    return fetchApi<any>(`/clinical/${opCaseId}/visits`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Diagnoses
  async addDiagnosis(opCaseId: string, data: AddDiagnosisInput): Promise<any> {
    return fetchApi<any>(`/clinical/${opCaseId}/diagnoses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDiagnosis(diagnosisId: string, data: { code?: string; description?: string; type?: 'PRIMARY' | 'SECONDARY' }): Promise<any> {
    return fetchApi<any>(`/clinical/diagnoses/${diagnosisId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteDiagnosis(diagnosisId: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/clinical/diagnoses/${diagnosisId}`, {
      method: 'DELETE',
    });
  },

  // Clinical Notes
  async addClinicalNote(opCaseId: string, data: AddClinicalNoteInput): Promise<any> {
    return fetchApi<any>(`/clinical/${opCaseId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Prescriptions
  async addPrescription(opCaseId: string, data: AddPrescriptionInput): Promise<any> {
    return fetchApi<any>(`/clinical/${opCaseId}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPrescription(prescriptionId: string): Promise<any> {
    return fetchApi<any>(`/clinical/prescriptions/${prescriptionId}`);
  },

  // Follow-ups
  async addFollowUp(opCaseId: string, data: AddFollowUpInput): Promise<any> {
    return fetchApi<any>(`/clinical/${opCaseId}/followups`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFollowUp(followUpId: string, data: { dueDate?: string; reason?: string; status?: 'PENDING' | 'COMPLETED' | 'CANCELLED' }): Promise<any> {
    return fetchApi<any>(`/clinical/followups/${followUpId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // ICD-10
  async searchIcd10(query: string, limit = 20): Promise<Icd10Code[]> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (limit) params.append('limit', String(limit));
    return fetchApi<Icd10Code[]>(`/clinical/icd10/search?${params.toString()}`);
  },

  // Providers (doctors)
  async getProviders(): Promise<{ id: string; name: string; staffType?: string }[]> {
    const response = await fetchApi<{ data: any[]; meta: any }>('/staff?isProvider=true&limit=100');
    return (response.data || []).filter((p) => p.isProvider && p.staffType === 'DOCTOR');
  },
};