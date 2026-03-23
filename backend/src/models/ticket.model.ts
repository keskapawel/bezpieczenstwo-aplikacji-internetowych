import db from '../database';

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  created_by: number;
  assigned_to: number | null;
  department: string;
  created_at: string;
  updated_at: string;
}

export function getTicketsByUser(userId: number): Ticket[] {
  return db
    .prepare('SELECT * FROM tickets WHERE created_by = ? ORDER BY created_at DESC')
    .all(userId) as Ticket[];
}

export function getTicketsByDepartment(department: string): Ticket[] {
  return db
    .prepare('SELECT * FROM tickets WHERE department = ? ORDER BY created_at DESC')
    .all(department) as Ticket[];
}

export function getAllTickets(): Ticket[] {
  return db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as Ticket[];
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
