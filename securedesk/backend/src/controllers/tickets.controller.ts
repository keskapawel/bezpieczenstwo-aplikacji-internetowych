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
} from '../models/ticket.model';
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

  let tickets: Ticket[];
  const { role } = req.user;

  if (role === 'EMPLOYEE') {
    tickets = getTicketsByUser(req.user.userId);
  } else if (role === 'MANAGER') {
    tickets = getTicketsByDepartment(req.user.department);
  } else {
    tickets = getAllTickets();
  }

  const { status, priority, department } = req.query as {
    status?: string;
    priority?: string;
    department?: string;
  };

  if (status) tickets = tickets.filter((t) => t.status === status);
  if (priority) tickets = tickets.filter((t) => t.priority === priority);
  if (department && role === 'ADMIN') tickets = tickets.filter((t) => t.department === department);

  res.status(200).json({ success: true, data: { tickets, total: tickets.length } });
}

export function getTicketByIdHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const id = parseInt(req.params['id'] ?? '0', 10);
  const ticket = getTicketById(id);

  if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

  if (req.user.role === 'EMPLOYEE' && ticket.created_by !== req.user.userId) {
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
    status: 'OPEN',
    priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
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

  if (req.user.role === 'EMPLOYEE') {
    if (ticket.created_by !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Access denied' }); return;
    }
    if (ticket.status !== 'OPEN') {
      res.status(403).json({ success: false, error: 'Can only edit OPEN tickets' }); return;
    }
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
  } else {
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status as Ticket['status'];
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
  logEvent(req.user.userId, `TICKET_DELETED: id=${id}`, req, true);
  res.status(200).json({ success: true, data: { message: 'Ticket deleted' } });
}

export function getTicketStatsHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
  const stats = getTicketStats();
  res.status(200).json({ success: true, data: { stats } });
}
