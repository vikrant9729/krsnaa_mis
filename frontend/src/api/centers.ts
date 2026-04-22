import { api } from './index';

export interface Center {
  id: number;
  center_code: string;
  name: string;
  center_type: 'HLM' | 'CC' | 'PROJECT';
  owner_id?: string;
  parent_id?: number;
  base_center_id?: number;
  is_base_center: boolean;
  type?: string;
  bill_type?: string;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CenterCreate {
  center_code: string;
  name: string;
  center_type: 'HLM' | 'CC' | 'PROJECT';
  owner_id?: string;
  parent_id?: number;
  is_base_center?: boolean;
  metadata_json?: Record<string, any>;
}

export const centersApi = {
  getAll: async (): Promise<Center[]> => {
    const response = await api.get<Center[]>('/api/centers');
    return response.data;
  },

  getById: async (id: number): Promise<Center> => {
    const response = await api.get<Center>(`/api/centers/${id}`);
    return response.data;
  },

  create: async (data: CenterCreate): Promise<Center> => {
    const response = await api.post<Center>('/api/centers', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CenterCreate>): Promise<Center> => {
    const response = await api.patch<Center>(`/api/centers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/centers/${id}`);
  },

  deleteAll: async (): Promise<void> => {
    await api.delete('/api/centers/all/confirm');
  },

  bulkDelete: async (ids: number[]): Promise<void> => {
    await api.post('/api/centers/bulk-delete', { ids });
  },

  getHierarchy: async (): Promise<Center[]> => {
    const response = await api.get<Center[]>('/api/centers/hierarchy');
    return response.data;
  },
};
