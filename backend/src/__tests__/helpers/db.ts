import bcrypt from 'bcrypt';
import db from '../../database';

export interface TestUser {
  id: number;
  email: string;
  password: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  department: string;
}

export const testUsers: TestUser[] = [
  { id: 1, email: 'admin@test.com',     password: 'Admin123',    role: 'ADMIN',    department: 'IT' },
  { id: 2, email: 'manager@test.com',   password: 'Manager123',  role: 'MANAGER',  department: 'IT' },
  { id: 3, email: 'employee1@test.com', password: 'Employee123', role: 'EMPLOYEE', department: 'IT' },
  { id: 4, email: 'employee2@test.com', password: 'Employee456', role: 'EMPLOYEE', department: 'HR' },
  { id: 5, email: 'inactive@test.com',  password: 'Inactive123', role: 'EMPLOYEE', department: 'IT' },
];

export async function seedTestDb(): Promise<void> {
  db.exec(`
    DELETE FROM ticket_comments;
    DELETE FROM tickets;
    DELETE FROM refresh_tokens;
    DELETE FROM security_logs;
    DELETE FROM users;
  `);

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role, department, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const u of testUsers) {
    const hash = await bcrypt.hash(u.password, 1);
    const isActive = u.email === 'inactive@test.com' ? 0 : 1;
    insertUser.run(u.id, u.email, hash, u.email.split('@')[0], u.role, u.department, isActive);
  }

  // Seed tickets: employee1 owns ticket 1 (IT dept), employee2 owns ticket 2 (HR dept)
  db.prepare(
    `INSERT INTO tickets (id, title, description, priority, category, created_by, department)
     VALUES (1, 'IT Ticket', 'IT issue', 'MEDIUM', 'Hardware', 3, 'IT')`
  ).run();
  db.prepare(
    `INSERT INTO tickets (id, title, description, priority, category, created_by, department)
     VALUES (2, 'HR Ticket', 'HR issue', 'LOW', 'Access', 4, 'HR')`
  ).run();
}
