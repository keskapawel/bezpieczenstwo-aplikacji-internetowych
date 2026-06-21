import { Router } from 'express';
import { body } from 'express-validator';
import { loginRateLimiter } from '../middleware/rateLimiter.middleware';
import { validateCsrf } from '../middleware/csrf.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  login,
  refresh,
  logout,
  getLockedUsers,
  resetLockout,
  verifyTwoFactorLogin,
  startTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from '../controllers/auth.controller';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty().isString()],
  login
);

router.post(
  '/login/2fa',
  loginRateLimiter,
  [body('pendingToken').notEmpty().isString(), body('code').isLength({ min: 6, max: 6 }).isNumeric()],
  verifyTwoFactorLogin
);

router.post('/refresh', validateCsrf, refresh);
router.post('/logout', validateCsrf, logout);

router.post('/2fa/setup', authenticateToken, startTwoFactorSetup);
router.post(
  '/2fa/enable',
  authenticateToken,
  [body('code').isLength({ min: 6, max: 6 }).isNumeric()],
  enableTwoFactor
);
router.post(
  '/2fa/disable',
  authenticateToken,
  [body('code').optional().isLength({ min: 6, max: 6 }).isNumeric()],
  disableTwoFactor
);

// Admin lockout management — no JWT auth, protected by ADMIN_SECRET
router.get('/admin/locked-users', getLockedUsers);
router.post('/admin/reset-lockout', resetLockout);

export default router;
