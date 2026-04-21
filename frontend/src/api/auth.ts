import { api } from './index';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  full_name: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER';
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<Token> => {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    
    const response = await api.post<Token>('/api/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await api.post<User>('/api/auth/register', data);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/api/auth/me');
    return response.data;
  },
};
