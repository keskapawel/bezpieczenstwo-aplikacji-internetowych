import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getTickets,
  getTicketByIdHandler,
  createTicketHandler,
  updateTicketHandler,
  deleteTicketHandler,
  getTicketStatsHandler,
} from '../controllers/tickets.controller';
import commentsRouter from './comments.routes';

const router = Router();

router.use(authenticateToken);

router.get('/stats', getTicketStatsHandler);

router.get('/', getTickets);

router.post(
  '/',
  [
    body('title').notEmpty().isString().trim(),
    body('description').notEmpty().isString().trim(),
    body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('category').notEmpty().isString().trim(),
  ],
  createTicketHandler
);

router.get('/:id', param('id').isInt(), getTicketByIdHandler);

router.patch(
  '/:id',
  [
    param('id').isInt(),
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    body('title').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('assigned_to').optional().isInt(),
  ],
  updateTicketHandler
);

router.delete('/:id', requireRole('ADMIN'), param('id').isInt(), deleteTicketHandler);

// Nested comments under /:ticketId/comments
router.use('/:ticketId/comments', commentsRouter);

export default router;
