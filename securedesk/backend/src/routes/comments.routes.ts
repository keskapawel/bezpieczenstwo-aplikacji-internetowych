import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { getComments, addComment, editComment, removeComment } from '../controllers/comments.controller';

// mergeParams: true allows access to :ticketId from parent router
const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.get('/', getComments);

router.post(
  '/',
  [body('content').notEmpty().isString().trim()],
  addComment
);

router.patch(
  '/:commentId',
  [
    param('commentId').isInt(),
    body('content').notEmpty().isString().trim(),
  ],
  editComment
);

router.delete('/:commentId', param('commentId').isInt(), removeComment);

export default router;
