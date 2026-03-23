import { Request, Response, NextFunction } from 'express';

// Double-submit cookie CSRF protection.
// On login the server sets a non-httpOnly `csrfToken` cookie. For every
// cookie-dependent mutating endpoint (refresh, logout) the client must echo
// the same value back in the `X-CSRF-Token` request header.
// Because cross-origin requests cannot set custom headers, an attacker driving
// CSRF from a different origin can never pass this check.
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies['csrfToken'] as string | undefined;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ success: false, error: 'Invalid or missing CSRF token' });
    return;
  }
  next();
}
