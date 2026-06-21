import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { validationResult } from 'express-validator';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { findUserByEmail, findUserById, sanitizeUser } from '../models/user.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { generateCaptcha, validateCaptcha } from '../utils/captcha.utils';
import { SecurityAction } from '../enums';
import db from '../database';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

// Non-httpOnly so the frontend JavaScript can read and echo it as X-CSRF-Token header.
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const LOCK_THRESHOLD = 5;       // lock after this many failures
const CAPTCHA_THRESHOLD = 3;    // require captcha after this many failures
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TWO_FACTOR_ISSUER = 'SecureDesk';

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

interface TwoFactorChallengeRow {
  id: number;
  user_id: number;
  expires_at: string;
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

function hashChallengeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueAuthSession(user: NonNullable<ReturnType<typeof findUserById>>, req: Request, res: Response): Promise<void> {
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

  logSecurityEvent(user.id, SecurityAction.LOGIN_SUCCESS, req, true);

  const csrfToken = randomUUID();
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  res.cookie('csrfToken', csrfToken, CSRF_COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { accessToken, user: sanitizeUser(user), csrfToken } });
}

function createTwoFactorChallenge(userId: number): string {
  const pendingToken = randomUUID();
  const expiresAt = new Date(Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS).toISOString();

  db.prepare('DELETE FROM two_factor_challenges WHERE user_id = ? OR expires_at <= ?')
    .run(userId, new Date().toISOString());
  db.prepare(
    'INSERT INTO two_factor_challenges (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hashChallengeToken(pendingToken), expiresAt);

  return pendingToken;
}

function isValidTotpFormat(code: string | undefined): code is string {
  return typeof code === 'string' && /^\d{6}$/.test(code.trim());
}

function verifyTotpCode(code: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    token: code.trim(),
    encoding: 'base32',
    step: 30,
    window: 1,
  });
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
    logSecurityEvent(null, SecurityAction.LOGIN_FAILED, req, false);
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
    logSecurityEvent(user.id, SecurityAction.LOGIN_FAILED, req, false);
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

  if (user.two_factor_enabled === 1 && user.two_factor_secret) {
    const pendingToken = createTwoFactorChallenge(user.id);
    res.status(202).json({
      success: true,
      data: {
        twoFactorRequired: true,
        pendingToken,
        expiresInSeconds: TWO_FACTOR_CHALLENGE_TTL_MS / 1000,
      },
    });
    return;
  }

  await issueAuthSession(user, req, res);
}

export async function verifyTwoFactorLogin(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const { pendingToken, code } = req.body as { pendingToken?: string; code?: string };
  if (!pendingToken || !isValidTotpFormat(code)) {
    res.status(422).json({ success: false, error: 'Pending token and a 6-digit code are required' });
    return;
  }

  const challenge = db.prepare(
    'SELECT id, user_id, expires_at FROM two_factor_challenges WHERE token_hash = ?'
  ).get(hashChallengeToken(pendingToken)) as TwoFactorChallengeRow | undefined;

  if (!challenge || new Date(challenge.expires_at) <= new Date()) {
    if (challenge) {
      db.prepare('DELETE FROM two_factor_challenges WHERE id = ?').run(challenge.id);
    }
    res.status(401).json({ success: false, error: '2FA challenge expired or invalid' });
    return;
  }

  const user = findUserById(challenge.user_id);
  if (!user || user.is_active === 0 || user.two_factor_enabled !== 1 || !user.two_factor_secret) {
    db.prepare('DELETE FROM two_factor_challenges WHERE id = ?').run(challenge.id);
    res.status(401).json({ success: false, error: '2FA challenge expired or invalid' });
    return;
  }

  if (!verifyTotpCode(code, user.two_factor_secret)) {
    logSecurityEvent(user.id, SecurityAction.LOGIN_FAILED, req, false);
    res.status(401).json({ success: false, error: 'Invalid authenticator code' });
    return;
  }

  db.prepare('DELETE FROM two_factor_challenges WHERE id = ?').run(challenge.id);
  await issueAuthSession(user, req, res);
}

export async function startTwoFactorSetup(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  const user = findUserById(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (user.two_factor_enabled === 1) {
    res.status(409).json({ success: false, error: '2FA is already enabled' });
    return;
  }

  const generatedSecret = speakeasy.generateSecret({
    name: `${TWO_FACTOR_ISSUER}:${user.email}`,
    issuer: TWO_FACTOR_ISSUER,
    length: 20,
  });
  const secret = generatedSecret.base32;
  const otpauthUrl = generatedSecret.otpauth_url;
  if (!otpauthUrl) {
    res.status(500).json({ success: false, error: 'Could not create 2FA setup URI' });
    return;
  }
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  db.prepare('UPDATE users SET two_factor_secret = ?, two_factor_enabled = 0 WHERE id = ?')
    .run(secret, user.id);

  res.status(200).json({
    success: true,
    data: {
      otpauthUrl,
      qrCodeDataUrl,
      manualEntryKey: secret,
    },
  });
}

export function enableTwoFactor(req: Request, res: Response): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const userId = req.user?.userId;
  const { code } = req.body as { code?: string };
  if (!userId || !isValidTotpFormat(code)) {
    res.status(422).json({ success: false, error: 'A 6-digit code is required' });
    return;
  }

  const user = findUserById(userId);
  if (!user || !user.two_factor_secret) {
    res.status(400).json({ success: false, error: 'Start 2FA setup before enabling it' });
    return;
  }

  if (!verifyTotpCode(code, user.two_factor_secret)) {
    res.status(401).json({ success: false, error: 'Invalid authenticator code' });
    return;
  }

  db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(user.id);
  const updatedUser = findUserById(user.id);
  res.status(200).json({ success: true, data: { user: updatedUser ? sanitizeUser(updatedUser) : sanitizeUser(user) } });
}

export function disableTwoFactor(req: Request, res: Response): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() });
    return;
  }

  const userId = req.user?.userId;
  const { code } = req.body as { code?: string };
  if (!userId) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  const user = findUserById(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  if (user.two_factor_enabled === 1) {
    if (!isValidTotpFormat(code) || !user.two_factor_secret || !verifyTotpCode(code, user.two_factor_secret)) {
      res.status(401).json({ success: false, error: 'Invalid authenticator code' });
      return;
    }
  }

  db.prepare('UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?').run(user.id);
  const updatedUser = findUserById(user.id);
  res.status(200).json({ success: true, data: { user: updatedUser ? sanitizeUser(updatedUser) : sanitizeUser(user) } });
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
    // A valid JWT was presented but its hash isn't in the DB — the token was already
    // consumed (rotated). Treat this as a reuse attack: revoke every session for this
    // user so an attacker who stole an old token cannot keep refreshing.
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(payload.userId);
    logSecurityEvent(payload.userId, SecurityAction.REFRESH_TOKEN_REUSE_DETECTED, req, false);
    res.status(401).json({ success: false, error: 'Token reuse detected. All sessions revoked.' });
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

  const refreshedUser = findUserById(payload.userId);
  if (!refreshedUser) {
    res.status(401).json({ success: false, error: 'User not found' });
    return;
  }

  const newCsrfToken = randomUUID();
  res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
  res.cookie('csrfToken', newCsrfToken, CSRF_COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { accessToken: newAccessToken, user: sanitizeUser(refreshedUser), csrfToken: newCsrfToken } });
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
  res.clearCookie('csrfToken', { path: '/' });
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
