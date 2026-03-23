import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getUsersHandler, updateUserRoleHandler } from '../controllers/users.controller';

const router = Router();

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/', getUsersHandler);

router.patch(
  '/:id/role',
  [param('id').isInt(), body('role').isIn(['EMPLOYEE', 'MANAGER', 'ADMIN'])],
  updateUserRoleHandler
);

export default router;
