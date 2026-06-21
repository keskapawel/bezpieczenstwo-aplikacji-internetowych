import { api } from './api.service';
import { ApiResponse, LoginResponse, LoginResult, TwoFactorSetupResponse, User } from '../types';

export const authService = {
  async login(email: string, password: string, captcha?: { captchaToken: string; captchaAnswer: string }): Promise<LoginResult> {
    const response = await api.post<ApiResponse<LoginResult>>('/api/auth/login', {
      email,
      password,
      ...captcha,
    });
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data;
  },

  async verifyTwoFactorLogin(pendingToken: string, code: string): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/api/auth/login/2fa', {
      pendingToken,
      code,
    });
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data;
  },

  async startTwoFactorSetup(): Promise<TwoFactorSetupResponse> {
    const response = await api.post<ApiResponse<TwoFactorSetupResponse>>('/api/auth/2fa/setup');
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data;
  },

  async enableTwoFactor(code: string): Promise<User> {
    const response = await api.post<ApiResponse<{ user: User }>>('/api/auth/2fa/enable', { code });
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data.user;
  },

  async disableTwoFactor(code: string): Promise<User> {
    const response = await api.post<ApiResponse<{ user: User }>>('/api/auth/2fa/disable', { code });
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },
};
