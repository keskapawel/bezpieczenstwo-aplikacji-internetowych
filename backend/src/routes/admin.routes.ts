import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getSecurityLogsHandler } from '../controllers/users.controller';

const router = Router();

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/logs', getSecurityLogsHandler);

export default router;
