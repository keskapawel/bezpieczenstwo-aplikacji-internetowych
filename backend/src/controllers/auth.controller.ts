import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { findUserByEmail, sanitizeUser } from '../models/user.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { generateCaptcha, validateCaptcha } from '../utils/captcha.utils';
import db from '../database';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const LOCK_THRESHOLD = 5;       // lock after this many failures
const CAPTCHA_THRESHOLD = 3;    // require captcha after this many failures
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface StoredToken {
  id: number;
  token_hash: string;
  user_id: number;
  expires_at: string;
}

interface LoginAttemptRow {
  attempts: number;
  locked_until: string | null;
}

function logSecurityEvent(userId: number | null, action: string, req: Request, success: boolean): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  db.prepare(
    'INSERT INTO security_logs (user_id, action, ip_address, user_agent, success) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, ip, userAgent, success ? 1 : 0);
}

function getAttempts(email: string): LoginAttemptRow {
  const row = db.prepare(
    'SELECT attempts, locked_until FROM login_attempts WHERE email = ?'
  ).get(email) as LoginAttemptRow | undefined;
  return row ?? { attempts: 0, locked_until: null };
}

function incrementAttempts(email: string): number {
  const current = getAttempts(email);
  const newCount = current.attempts + 1;
  const lockedUntil = newCount >= LOCK_THRESHOLD
    ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
    : null;
  db.prepare(`
    INSERT INTO login_attempts (email, attempts, locked_until, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      attempts = excluded.attempts,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  `).run(email, newCount, lockedUntil);
  return newCount;
}

function clearAttempts(email: string): void {
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
}

export async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const { email, password, captchaToken, captchaAnswer } = req.body as {
    email: string;
    password: string;
    captchaToken?: string;
    captchaAnswer?: string;
  };

  // Check lockout
  const attemptRecord = getAttempts(email);
  if (attemptRecord.locked_until && new Date(attemptRecord.locked_until) > new Date()) {
    res.status(423).json({
      success: false,
      error: 'Account temporarily locked due to too many failed login attempts',
      lockedUntil: attemptRecord.locked_until,
    });
    return;
  }

  // Validate CAPTCHA if required
  if (attemptRecord.attempts >= CAPTCHA_THRESHOLD) {
    if (!captchaToken || !captchaAnswer) {
      const challenge = generateCaptcha();
      res.status(401).json({
        success: false,
        error: 'CAPTCHA required',
        captchaRequired: true,
        captchaToken: challenge.token,
        captchaQuestion: challenge.question,
      });
      return;
    }
    if (!validateCaptcha(captchaToken, captchaAnswer)) {
      const challenge = generateCaptcha();
      res.status(401).json({
        success: false,
        error: 'Incorrect CAPTCHA answer',
        captchaRequired: true,
        captchaToken: challenge.token,
        captchaQuestion: challenge.question,
      });
      return;
    }
  }

  const user = findUserByEmail(email);
  if (!user) {
    const newCount = incrementAttempts(email);
    logSecurityEvent(null, 'LOGIN_FAILED', req, false);
    const failRes: Record<string, unknown> = { success: false, error: 'Invalid credentials' };
    if (newCount >= CAPTCHA_THRESHOLD && newCount < LOCK_THRESHOLD) {
      const challenge = generateCaptcha();
      failRes['captchaRequired'] = true;
      failRes['captchaToken'] = challenge.token;
      failRes['captchaQuestion'] = challenge.question;
    }
    res.status(401).json(failRes);
    return;
  }

  if (user.is_active === 0) {
    res.status(403).json({ success: false, error: 'Account is deactivated' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    const newCount = incrementAttempts(user.id ? email : email);
    logSecurityEvent(user.id, 'LOGIN_FAILED', req, false);
    const failRes: Record<string, unknown> = { success: false, error: 'Invalid credentials' };
    if (newCount >= CAPTCHA_THRESHOLD && newCount < LOCK_THRESHOLD) {
      const challenge = generateCaptcha();
      failRes['captchaRequired'] = true;
      failRes['captchaToken'] = challenge.token;
      failRes['captchaQuestion'] = challenge.question;
    }
    res.status(401).json(failRes);
    return;
  }

  clearAttempts(email);

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    department: user.department,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, tokenHash, expiresAt);

  logSecurityEvent(user.id, 'LOGIN_SUCCESS', req, true);

  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { accessToken, user: sanitizeUser(user) } });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies['refreshToken'] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'Refresh token required' });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
    return;
  }

  const storedTokens = db.prepare(
    "SELECT id, token_hash, user_id, expires_at FROM refresh_tokens WHERE user_id = ? AND expires_at > datetime('now')"
  ).all(payload.userId) as StoredToken[];

  let matchedToken: StoredToken | null = null;
  for (const stored of storedTokens) {
    const isMatch = await bcrypt.compare(refreshToken, stored.token_hash);
    if (isMatch) { matchedToken = stored; break; }
  }

  if (!matchedToken) {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    return;
  }

  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(matchedToken.id);

  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    department: payload.department,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  const newTokenHash = await bcrypt.hash(newRefreshToken, 10);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(payload.userId, newTokenHash, newExpiresAt);

  res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { accessToken: newAccessToken } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies['refreshToken'] as string | undefined;

  if (refreshToken) {
    try {
      const allTokens = db.prepare('SELECT id, token_hash, user_id FROM refresh_tokens').all() as StoredToken[];
      for (const stored of allTokens) {
        const isMatch = await bcrypt.compare(refreshToken, stored.token_hash);
        if (isMatch) {
          db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
          break;
        }
      }
    } catch {
      // Ignore errors during logout cleanup
    }
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
}

// Admin: list currently locked accounts (protected by ADMIN_SECRET)
export function getLockedUsers(req: Request, res: Response): void {
  const { adminSecret } = req.query as { adminSecret?: string };
  if (!adminSecret || adminSecret !== (process.env['ADMIN_SECRET'] ?? 'securedesk-admin-secret-dev')) {
    res.status(403).json({ success: false, error: 'Invalid admin secret' });
    return;
  }

  interface LockedRow { email: string; attempts: number; locked_until: string | null }
  const locked = db.prepare(
    "SELECT email, attempts, locked_until FROM login_attempts WHERE locked_until > datetime('now') ORDER BY locked_until DESC"
  ).all() as LockedRow[];

  res.status(200).json({ success: true, data: { locked } });
}

// Admin: reset lockout for a specific email (protected by ADMIN_SECRET)
export function resetLockout(req: Request, res: Response): void {
  const { email, adminSecret } = req.body as { email?: string; adminSecret?: string };
  if (!adminSecret || adminSecret !== (process.env['ADMIN_SECRET'] ?? 'securedesk-admin-secret-dev')) {
    res.status(403).json({ success: false, error: 'Invalid admin secret' });
    return;
  }
  if (!email) {
    res.status(422).json({ success: false, error: 'Email is required' });
    return;
  }

  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
  res.status(200).json({ success: true, data: { message: `Lockout cleared for ${email}` } });
}
