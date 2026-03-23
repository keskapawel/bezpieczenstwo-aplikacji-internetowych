import { api } from './api.service';
import { ApiResponse, Ticket } from '../types';

export interface CreateTicketData {
  title: string;
  description: string;
  priority: string;
  category: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: string;
  assigned_to?: number | null;
}

interface TicketsListResponse {
  tickets: Ticket[];
  total: number;
}

interface TicketFilters {
  status?: string;
  priority?: string;
  department?: string;
}

export const ticketsService = {
  async getTickets(filters?: TicketFilters): Promise<TicketsListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.department) params.append('department', filters.department);
    const query = params.toString();
    const url = query ? `/api/tickets?${query}` : '/api/tickets';
    const response = await api.get<ApiResponse<TicketsListResponse>>(url);
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async getTicketById(id: number): Promise<Ticket> {
    const response = await api.get<ApiResponse<Ticket>>(`/api/tickets/${id}`);
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async createTicket(data: CreateTicketData): Promise<Ticket> {
    const response = await api.post<ApiResponse<Ticket>>('/api/tickets', data);
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async updateTicket(id: number, data: UpdateTicketData): Promise<Ticket> {
    const response = await api.patch<ApiResponse<Ticket>>(`/api/tickets/${id}`, data);
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async deleteTicket(id: number): Promise<void> {
    await api.delete(`/api/tickets/${id}`);
  },
};
