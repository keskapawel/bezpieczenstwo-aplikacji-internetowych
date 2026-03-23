import db from '../database';

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends Comment {
  author_name: string;
  author_email: string;
}

export function getCommentsByTicketId(ticketId: number): CommentWithAuthor[] {
  return db
    .prepare(
      `SELECT tc.*, u.name AS author_name, u.email AS author_email
       FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at ASC`
    )
    .all(ticketId) as CommentWithAuthor[];
}

export function getCommentById(id: number): Comment | undefined {
  return db
    .prepare('SELECT * FROM ticket_comments WHERE id = ?')
    .get(id) as Comment | undefined;
}

export function createComment(ticketId: number, userId: number, content: string): CommentWithAuthor {
  const result = db
    .prepare('INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES (?, ?, ?)')
    .run(ticketId, userId, content);
  return db
    .prepare(
      `SELECT tc.*, u.name AS author_name, u.email AS author_email
       FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`
    )
    .get(result.lastInsertRowid) as CommentWithAuthor;
}

export function updateComment(id: number, content: string): CommentWithAuthor | undefined {
  db.prepare("UPDATE ticket_comments SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(content, id);
  return db
    .prepare(
      `SELECT tc.*, u.name AS author_name, u.email AS author_email
       FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`
    )
    .get(id) as CommentWithAuthor | undefined;
}

export function deleteComment(id: number): void {
  db.prepare('DELETE FROM ticket_comments WHERE id = ?').run(id);
}
