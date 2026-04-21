import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hasHydratedAuth: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setAuthHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
  hasHydratedAuth: false,
  
  login: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, hasHydratedAuth: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, hasHydratedAuth: true });
  },
  
  setUser: (user) => set({ user }),
  setAuthHydrated: (value) => set({ hasHydratedAuth: value }),
}));
