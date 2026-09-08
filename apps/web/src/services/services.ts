import { fetchApi } from '../lib/api';

export type ServiceMasterCategory = 'CONSULTATION' | 'REVIEW' | 'OTHER';

export interface ServiceMaster {
  id: string;
  code: string;
  name: string;
  category: ServiceMasterCategory;
  price: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export const servicesApi = {
  categories() {
    return fetchApi<ServiceMasterCategory[]>('/services/categories');
  },
  list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: ServiceMasterCategory;
    activeOnly?: boolean;
  }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.activeOnly) q.set('activeOnly', 'true');
    return fetchApi<Paginated<ServiceMaster>>(`/services?${q.toString()}`);
  },
  create(data: {
    code: string;
    name: string;
    category?: ServiceMasterCategory;
    price: number;
    description?: string;
    isActive?: boolean;
  }) {
    return fetchApi<ServiceMaster>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update(
    id: string,
    data: {
      name?: string;
      category?: ServiceMasterCategory;
      price?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return fetchApi<ServiceMaster>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
