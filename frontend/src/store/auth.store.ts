import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  accessToken: string | null;
  csrfToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  secondsLeft: number | null;
  login: (token: string, user: User, csrfToken: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
  setCsrfToken: (token: string) => void;
  setInitializing: (value: boolean) => void;
  setSecondsLeft: (seconds: number | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  csrfToken: null,
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  secondsLeft: null,
  login: (token: string, user: User, csrfToken: string) =>
    set({ accessToken: token, user, isAuthenticated: true, csrfToken }),
  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false, csrfToken: null, secondsLeft: null }),
  setAccessToken: (token: string) =>
    set({ accessToken: token }),
  setCsrfToken: (token: string) =>
    set({ csrfToken: token }),
  setInitializing: (value: boolean) =>
    set({ isInitializing: value }),
  setSecondsLeft: (seconds: number | null) =>
    set({ secondsLeft: seconds }),
}));
