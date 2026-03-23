import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  getTicketsByUser,
  getTicketsByDepartment,
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketStats,
  Ticket,
  TicketFilters,
} from '../models/ticket.model';
import { UserRole, TicketStatus, TicketPriority, SecurityAction } from '../enums';
import db from '../database';

function logEvent(userId: number | null, action: string, req: Request, success: boolean): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  db.prepare(
    'INSERT INTO security_logs (user_id, action, ip_address, user_agent, success) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, ip, userAgent, success ? 1 : 0);
}

export function getTickets(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const { role } = req.user;
  const { status, priority, department, page: pageStr, limit: limitStr } = req.query as {
    status?: string;
    priority?: string;
    department?: string;
    page?: string;
    limit?: string;
  };

  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '10', 10) || 10));

  const filters: TicketFilters = {
    status: status || undefined,
    priority: priority || undefined,
    // Only ADMIN can filter by department
    department: (role === UserRole.ADMIN && department) ? department : undefined,
  };

  let result;
  if (role === UserRole.EMPLOYEE) {
    result = getTicketsByUser(req.user.userId, filters, page, limit);
  } else if (role === UserRole.MANAGER) {
    result = getTicketsByDepartment(req.user.department, filters, page, limit);
  } else {
    result = getAllTickets(filters, page, limit);
  }

  res.status(200).json({ success: true, data: result });
}

export function getTicketByIdHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const id = parseInt(req.params['id'] ?? '0', 10);
  const ticket = getTicketById(id);

  if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

  if (req.user.role === UserRole.EMPLOYEE && ticket.created_by !== req.user.userId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  res.status(200).json({ success: true, data: ticket });
}

export function createTicketHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const { title, description, priority, category } = req.body as {
    title: string;
    description: string;
    priority: string;
    category: string;
  };

  const ticket = createTicket({
    title,
    description,
    status: TicketStatus.OPEN,
    priority: priority as TicketPriority,
    category,
    created_by: req.user.userId,
    assigned_to: null,
    department: req.user.department,
  });

  res.status(201).json({ success: true, data: ticket });
}

export function updateTicketHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const id = parseInt(req.params['id'] ?? '0', 10);
  const ticket = getTicketById(id);
  if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

  const { title, description, status, assigned_to } = req.body as {
    title?: string;
    description?: string;
    status?: string;
    assigned_to?: number;
  };

  const updates: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'assigned_to'>> = {};

  if (req.user.role === UserRole.EMPLOYEE) {
    if (ticket.created_by !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Access denied' }); return;
    }
    if (ticket.status !== TicketStatus.OPEN) {
      res.status(403).json({ success: false, error: 'Can only edit OPEN tickets' }); return;
    }
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
  } else {
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status as TicketStatus;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
  }

  const updated = updateTicket(id, updates);
  res.status(200).json({ success: true, data: updated });
}

export function deleteTicketHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const id = parseInt(req.params['id'] ?? '0', 10);
  const ticket = getTicketById(id);
  if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

  deleteTicket(id);
  logEvent(req.user.userId, `${SecurityAction.TICKET_DELETED}: id=${id}`, req, true);
  res.status(200).json({ success: true, data: { message: 'Ticket deleted' } });
}

export function getTicketStatsHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
  const stats = getTicketStats();
  res.status(200).json({ success: true, data: { stats } });
}
