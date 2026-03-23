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
