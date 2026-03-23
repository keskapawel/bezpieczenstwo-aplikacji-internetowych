import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { userApiRateLimiter } from '../middleware/rateLimiter.middleware';
import { getUsersHandler, updateUserRoleHandler } from '../controllers/users.controller';
import { UserRole } from '../enums';

const router = Router();

router.use(authenticateToken, requireRole(UserRole.ADMIN), userApiRateLimiter);

router.get('/', getUsersHandler);

router.patch(
  '/:id/role',
  [param('id').isInt(), body('role').isIn(Object.values(UserRole))],
  updateUserRoleHandler
);

export default router;
