import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction, RequestHandler } from 'express';

const noopMiddleware: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => next();

export const loginRateLimiter: RequestHandler = process.env['NODE_ENV'] === 'test'
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: { success: false, error: 'Too many login attempts, please try again after 15 minutes' },
      standardHeaders: true,
      legacyHeaders: false,
    });

export const apiRateLimiter: RequestHandler = process.env['NODE_ENV'] === 'test'
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { success: false, error: 'Too many requests, please try again after 15 minutes' },
      standardHeaders: true,
      legacyHeaders: false,
    });

// Per-user rate limiter — runs after authenticateToken so req.user is available.
// Falls back to IP for unauthenticated requests that slip through.
export const userApiRateLimiter: RequestHandler = process.env['NODE_ENV'] === 'test'
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      keyGenerator: (req: Request): string =>
        req.user?.userId?.toString() ?? req.ip ?? 'unknown',
      message: { success: false, error: 'Too many requests for this account, please try again after 15 minutes' },
      standardHeaders: true,
      legacyHeaders: false,
    });
