import db from '../database';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  department: string;
  created_at: string;
  is_active: number;
}

export type SafeUser = Omit<User, 'password_hash'>;

export function sanitizeUser(user: User): SafeUser {
  const { password_hash: _ph, ...safe } = user;
  return safe;
}

export function findUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getAllUsers(): SafeUser[] {
  return db
    .prepare('SELECT id, email, name, role, department, created_at, is_active FROM users ORDER BY created_at DESC')
    .all() as SafeUser[];
}

export function updateUserRole(id: number, role: string): void {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}
