import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

function getCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, csrfToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    // Send CSRF token for cookie-dependent auth endpoints
    const isCookieEndpoint =
      config.url?.includes('/auth/refresh') ||
      config.url?.includes('/auth/logout');
    if (isCookieEndpoint) {
      const csrf = csrfToken ?? getCsrfCookie();
      if (csrf && config.headers) {
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const csrf = useAuthStore.getState().csrfToken ?? getCsrfCookie();
        const response = await axios.post<{
          success: boolean;
          data?: { accessToken: string; csrfToken?: string };
        }>(`${BASE_URL}/api/auth/refresh`, {}, {
          withCredentials: true,
          headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        });

        const newToken = response.data.data?.accessToken;
        if (!newToken) throw new Error('No token in refresh response');

        const newCsrf = response.data.data?.csrfToken;
        useAuthStore.getState().setAccessToken(newToken);
        if (newCsrf) useAuthStore.getState().setCsrfToken(newCsrf);
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        toast.error('Sesja wygasła. Zaloguj się ponownie.');
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
