import { api } from './api.service';
import { ApiResponse, TicketComment } from '../types';

interface CommentsResponse {
  comments: TicketComment[];
}

export const commentsService = {
  async getComments(ticketId: number): Promise<TicketComment[]> {
    const response = await api.get<ApiResponse<CommentsResponse>>(
      `/api/tickets/${ticketId}/comments`
    );
    return response.data.data?.comments ?? [];
  },

  async createComment(ticketId: number, content: string): Promise<TicketComment> {
    const response = await api.post<ApiResponse<TicketComment>>(
      `/api/tickets/${ticketId}/comments`,
      { content }
    );
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async updateComment(ticketId: number, commentId: number, content: string): Promise<TicketComment> {
    const response = await api.patch<ApiResponse<TicketComment>>(
      `/api/tickets/${ticketId}/comments/${commentId}`,
      { content }
    );
    if (!response.data.data) throw new Error('No data');
    return response.data.data;
  },

  async deleteComment(ticketId: number, commentId: number): Promise<void> {
    await api.delete(`/api/tickets/${ticketId}/comments/${commentId}`);
  },
};
