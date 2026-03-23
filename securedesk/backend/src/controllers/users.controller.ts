import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { getAllUsers, updateUserRole } from '../models/user.model';
import db from '../database';

interface SecurityLog {
  id: number;
  user_id: number | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  success: number;
}

export function getUsersHandler(_req: Request, res: Response): void {
  const users = getAllUsers();
  res.status(200).json({ success: true, data: { users } });
}

export function updateUserRoleHandler(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const targetId = parseInt(req.params['id'] ?? '0', 10);
  const { role } = req.body as { role: string };

  updateUserRole(targetId, role);

  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  db.prepare(
    'INSERT INTO security_logs (user_id, action, ip_address, user_agent, success) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.userId, `ROLE_CHANGED: userId=${targetId} to ${role}`, ip, userAgent, 1);

  res.status(200).json({ success: true, data: { message: 'Role updated successfully' } });
}

export function getSecurityLogsHandler(_req: Request, res: Response): void {
  const logs = db
    .prepare('SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT 50')
    .all() as SecurityLog[];
  res.status(200).json({ success: true, data: { logs } });
}
