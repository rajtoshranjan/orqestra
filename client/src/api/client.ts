import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { EnvVariables } from '@/config';
import { localStorageManager } from '@/lib/utils/local-storage-manager';

export const api = axios.create({
  baseURL: EnvVariables.apiUrl,
});

export const logout = () => {
  localStorageManager.removeToken();
  localStorageManager.removeRefreshToken();
  localStorageManager.removeActiveOrgId();
  window.location.href = '/login';
};

export const handleRefreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorageManager.getRefreshToken();
    if (refreshToken) {
      const res = await axios.post(
        `${EnvVariables.apiUrl}/accounts/token/refresh/`,
        {
          refresh: refreshToken,
        },
      );
      // CustomJsonRenderer wraps inside data: { access: ... }
      const newAccess = res.data?.data?.access;
      if (newAccess) {
        localStorageManager.setToken(newAccess);
        return newAccess;
      }
    }
    logout();
  } catch (e) {
    logout();
  }
  return null;
};

// Request Interceptor.
api.interceptors.request.use((config) => {
  const token = localStorageManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    const activeOrgId = localStorageManager.getActiveOrgId();
    if (activeOrgId) {
      config.headers['X-Active-Org-Id'] = activeOrgId;
    }
  }
  return config;
});

// Response Interceptor.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    // SimpleJWT returns 401 when token is invalid/expired.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/accounts/login/') &&
      !originalRequest.url?.includes('/accounts/token/refresh/')
    ) {
      originalRequest._retry = true;
      const newAccessToken = await handleRefreshToken();
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  },
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});
