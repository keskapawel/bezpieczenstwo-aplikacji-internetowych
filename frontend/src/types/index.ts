export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TicketCategory {
  TECHNICAL_ISSUE = 'Technical Issue',
  ACCESS_REQUEST = 'Access Request',
  HARDWARE = 'Hardware',
  SOFTWARE = 'Software',
  HR_REQUEST = 'HR Request',
  OTHER = 'Other',
}

export enum Department {
  IT = 'IT',
  HR = 'HR',
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  created_at: string;
  is_active: number;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  created_by: number;
  assigned_to: number | null;
  department: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityLog {
  id: number;
  user_id: number | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  success: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  csrfToken: string;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_email: string;
}
