import axios from 'axios';

export const api = axios.create();

// Dynamically set baseURL for each request if it's not already set
api.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
        if (process.env.NEXT_PUBLIC_API_URL) {
            config.baseURL = process.env.NEXT_PUBLIC_API_URL;
        } else if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                config.baseURL = `http://${hostname}:8000`;
            } else {
                config.baseURL = 'http://localhost:8000';
            }
        } else {
            config.baseURL = 'http://localhost:8000';
        }
        console.log(`[API] Connecting to: ${config.baseURL}`);
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
