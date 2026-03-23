import { api } from './api.service';
import { ApiResponse, LoginResponse } from '../types';

export const authService = {
  async login(email: string, password: string, captcha?: { captchaToken: string; captchaAnswer: string }): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/api/auth/login', {
      email,
      password,
      ...captcha,
    });
    if (!response.data.data) throw new Error('No data in response');
    return response.data.data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },
};
