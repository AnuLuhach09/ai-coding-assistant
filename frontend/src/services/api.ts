import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// VITE_API_URL should point at the backend's base URL, e.g.
// "https://my-backend.up.railway.app/api". If unset, requests are made to
// a relative "/api" path, which only works when the frontend is served
// from the same origin as the backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

console.log("API_BASE_URL =", API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401 Unauthorized
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });
        const { accessToken } = response.data.data;
        
        useAuthStore.getState().setToken(accessToken);
        
        isRefreshing = false;
        processQueue(null, accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
