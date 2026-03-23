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

export enum SecurityAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  REFRESH_TOKEN_REUSE_DETECTED = 'REFRESH_TOKEN_REUSE_DETECTED',
  TICKET_DELETED = 'TICKET_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
}
