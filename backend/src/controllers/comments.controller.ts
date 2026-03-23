import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  getCommentsByTicketId,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
} from '../models/comment.model';
import { getTicketById } from '../models/ticket.model';
import { UserRole } from '../enums';

function ticketId(req: Request): number {
  return parseInt(req.params['ticketId'] ?? '0', 10);
}

function commentId(req: Request): number {
  return parseInt(req.params['commentId'] ?? '0', 10);
}

/** Verify caller has read access to the ticket (mirrors ticket access rules). */
function hasTicketAccess(req: Request, tId: number): boolean {
  if (!req.user) return false;
  const ticket = getTicketById(tId);
  if (!ticket) return false;
  if (req.user.role === UserRole.EMPLOYEE && ticket.created_by !== req.user.userId) return false;
  if (req.user.role === UserRole.MANAGER && ticket.department !== req.user.department) return false;
  return true;
}

export function getComments(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const tId = ticketId(req);
  if (!hasTicketAccess(req, tId)) {
    res.status(403).json({ success: false, error: 'Access denied' }); return;
  }

  const comments = getCommentsByTicketId(tId);
  res.status(200).json({ success: true, data: { comments } });
}

export function addComment(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() }); return;
  }

  const tId = ticketId(req);
  if (!hasTicketAccess(req, tId)) {
    res.status(403).json({ success: false, error: 'Access denied' }); return;
  }

  const { content } = req.body as { content: string };
  const comment = createComment(tId, req.user.userId, content);
  res.status(201).json({ success: true, data: comment });
}

export function editComment(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: 'Validation failed', data: errors.array() }); return;
  }

  const cId = commentId(req);
  const comment = getCommentById(cId);
  if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }

  // Only owner or ADMIN can edit
  const isOwner = comment.user_id === req.user.userId;
  const isAdmin = req.user.role === UserRole.ADMIN;
  if (!isOwner && !isAdmin) {
    res.status(403).json({ success: false, error: 'You can only edit your own comments' }); return;
  }

  const { content } = req.body as { content: string };
  const updated = updateComment(cId, content);
  res.status(200).json({ success: true, data: updated });
}

export function removeComment(req: Request, res: Response): void {
  if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

  const cId = commentId(req);
  const comment = getCommentById(cId);
  if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }

  // Owner, MANAGER, or ADMIN can delete
  const isOwner = comment.user_id === req.user.userId;
  const isManagerOrAdmin = req.user.role === UserRole.MANAGER || req.user.role === UserRole.ADMIN;
  if (!isOwner && !isManagerOrAdmin) {
    res.status(403).json({ success: false, error: 'Insufficient permissions to delete this comment' }); return;
  }

  deleteComment(cId);
  res.status(200).json({ success: true, data: { message: 'Comment deleted' } });
}
