import { Router } from 'express';
import { body } from 'express-validator';
import { loginRateLimiter } from '../middleware/rateLimiter.middleware';
import { validateCsrf } from '../middleware/csrf.middleware';
import { login, refresh, logout, getLockedUsers, resetLockout } from '../controllers/auth.controller';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty().isString()],
  login
);

router.post('/refresh', validateCsrf, refresh);
router.post('/logout', validateCsrf, logout);

// Admin lockout management — no JWT auth, protected by ADMIN_SECRET
router.get('/admin/locked-users', getLockedUsers);
router.post('/admin/reset-lockout', resetLockout);

export default router;
