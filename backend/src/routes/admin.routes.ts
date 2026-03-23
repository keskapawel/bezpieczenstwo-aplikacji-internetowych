import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { userApiRateLimiter } from '../middleware/rateLimiter.middleware';
import { getSecurityLogsHandler } from '../controllers/users.controller';
import { UserRole } from '../enums';

const router = Router();

router.use(authenticateToken, requireRole(UserRole.ADMIN), userApiRateLimiter);

router.get('/logs', getSecurityLogsHandler);

export default router;
