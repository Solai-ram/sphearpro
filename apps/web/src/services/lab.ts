import { fetchApi } from '../lib/api';
import type { LabDashboard, LabProcedure, LabSampleType } from '../types/lab';
import type { Paginated } from '../types/therapy';

export const labApi = {
  getDashboard(): Promise<LabDashboard> {
    return fetchApi('/lab/dashboard');
  },
  getDepartments(): Promise<string[]> {
    return fetchApi('/lab/departments');
  },
  getSampleTypes(): Promise<LabSampleType[]> {
    return fetchApi('/lab/sample-types');
  },
  getProcedures(filters?: { search?: string; department?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.page) params.append('page', String(filters.page));
    params.append('limit', String(filters?.limit || 50));
    return fetchApi<Paginated<LabProcedure>>(`/lab/procedures?${params.toString()}`);
  },
  createProcedure(data: {
    code: string;
    name: string;
    department: string;
    sampleType: LabSampleType;
    price: number;
    tatHours: number;
    instructions?: string;
  }): Promise<LabProcedure> {
    return fetchApi('/lab/procedures', { method: 'POST', body: JSON.stringify(data) });
  },
};
