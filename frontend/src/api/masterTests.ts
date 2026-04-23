import api from './index';

export interface MasterTest {
  id: number;
  LAB_TestID: string;
  test_name: string;
  TestCategory_Mapped: string | null;
  specimen_type: string | null;
  metadata_json: Record<string, any>;
  mrp?: number;
  mrp_source_center?: string;
  custom_mrp?: number;
  mrp_source?: string;
  created_at: string;
}

export interface MasterTestListResponse {
  items: MasterTest[];
  total: number;
  pages: number;
  skip: number;
  limit: number;
}

export interface MasterTestFilters {
    categories: string[];
    sources: string[];
}

export const masterTestsApi = {
  getAll: async (skip = 0, limit = 50, search?: string, category?: string, mrp_source?: string): Promise<MasterTestListResponse> => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (mrp_source) params.append('mrp_source', mrp_source);
    
    const response = await api.get<MasterTestListResponse>(`/api/master-tests?${params}`);
    return response.data;
  },
  getFilters: async (): Promise<MasterTestFilters> => {
      const response = await api.get<MasterTestFilters>('/api/master-tests/filters');
      return response.data;
  },
  getById: async (id: number): Promise<MasterTest> => {
    const response = await api.get<MasterTest>(`/api/master-tests/${id}`);
    return response.data;
  },
  create: async (data: Partial<MasterTest>): Promise<MasterTest> => {
    const response = await api.post<MasterTest>('/api/master-tests', data);
    return response.data;
  },
  update: async (id: number, data: Partial<MasterTest>): Promise<MasterTest> => {
    const response = await api.patch<MasterTest>(`/api/master-tests/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/master-tests/${id}`);
  },
  syncFromDos: async (): Promise<{ synced: number }> => {
    const response = await api.post('/api/master-tests/sync-from-dos');
    return response.data;
  },
  deleteAll: async (): Promise<void> => {
    await api.delete('/api/master-tests/all');
  },
  bulkDelete: async (ids: number[]): Promise<void> => {
    await api.post('/api/master-tests/bulk-delete', { ids });
  },
};
