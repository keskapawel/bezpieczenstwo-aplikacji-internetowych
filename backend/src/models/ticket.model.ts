import db from '../database';
import { TicketStatus, TicketPriority } from '../enums';

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

export interface TicketFilters {
  status?: string;
  priority?: string;
  department?: string;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildFilterClauses(filters: TicketFilters, values: unknown[]): string {
  const clauses: string[] = [];
  if (filters.status) { clauses.push('status = ?'); values.push(filters.status); }
  if (filters.priority) { clauses.push('priority = ?'); values.push(filters.priority); }
  if (filters.department) { clauses.push('department = ?'); values.push(filters.department); }
  return clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';
}

export function getTicketsByUser(userId: number, filters: TicketFilters = {}, page = 1, limit = 10): PaginatedTickets {
  const countValues: unknown[] = [userId];
  const filterSql = buildFilterClauses(filters, countValues);
  const total = (db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE created_by = ?${filterSql}`).get(...countValues) as { count: number }).count;

  const dataValues: unknown[] = [userId];
  buildFilterClauses(filters, dataValues);
  const offset = (page - 1) * limit;
  dataValues.push(limit, offset);
  const tickets = db.prepare(`SELECT * FROM tickets WHERE created_by = ?${filterSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...dataValues) as Ticket[];

  return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function getTicketsByDepartment(department: string, filters: TicketFilters = {}, page = 1, limit = 10): PaginatedTickets {
  const countValues: unknown[] = [department];
  const filterSql = buildFilterClauses(filters, countValues);
  const total = (db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE department = ?${filterSql}`).get(...countValues) as { count: number }).count;

  const dataValues: unknown[] = [department];
  buildFilterClauses(filters, dataValues);
  const offset = (page - 1) * limit;
  dataValues.push(limit, offset);
  const tickets = db.prepare(`SELECT * FROM tickets WHERE department = ?${filterSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...dataValues) as Ticket[];

  return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function getAllTickets(filters: TicketFilters = {}, page = 1, limit = 10): PaginatedTickets {
  const countValues: unknown[] = [];
  const filterClauses: string[] = [];
  if (filters.status) { filterClauses.push('status = ?'); countValues.push(filters.status); }
  if (filters.priority) { filterClauses.push('priority = ?'); countValues.push(filters.priority); }
  if (filters.department) { filterClauses.push('department = ?'); countValues.push(filters.department); }
  const where = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as count FROM tickets ${where}`).get(...countValues) as { count: number }).count;
  const offset = (page - 1) * limit;
  const tickets = db.prepare(`SELECT * FROM tickets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...countValues, limit, offset) as Ticket[];

  return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function getTicketById(id: number): Ticket | undefined {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
}

export function createTicket(data: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Ticket {
  const result = db
    .prepare(
      'INSERT INTO tickets (title, description, status, priority, category, created_by, assigned_to, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      data.title,
      data.description,
      data.status,
      data.priority,
      data.category,
      data.created_by,
      data.assigned_to ?? null,
      data.department
    );
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid) as Ticket;
}

export function updateTicket(
  id: number,
  data: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'assigned_to'>>
): Ticket | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.assigned_to !== undefined) { fields.push('assigned_to = ?'); values.push(data.assigned_to); }

  if (fields.length === 0) {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
}

export function deleteTicket(id: number): void {
  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

export function getTicketStats(): { status: string; count: number }[] {
  return db
    .prepare('SELECT status, COUNT(*) as count FROM tickets GROUP BY status')
    .all() as { status: string; count: number }[];
}
