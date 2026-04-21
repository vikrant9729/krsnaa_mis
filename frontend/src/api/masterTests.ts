import api from './index';

export interface MasterTest {
  id: number;
  LAB_TestID: string;
  test_name: string;
  TestCategory_Mapped: string | null;
  specimen_type: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface MasterTestListResponse {
  items: MasterTest[];
  total: number;
  pages: number;
  skip: number;
  limit: number;
}

export const masterTestsApi = {
  getAll: async (skip = 0, limit = 50, search?: string): Promise<MasterTestListResponse> => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    
    const response = await api.get<MasterTestListResponse>(`/api/master-tests?${params}`);
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
