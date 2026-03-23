import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth.store';
import { ticketsService } from '../services/tickets.service';
import { commentsService } from '../services/comments.service';
import { Ticket, TicketStatus, TicketComment, UserRole } from '../types';
import { Navbar } from '../components/Navbar';

const STATUSES = Object.values(TicketStatus);

// ─── Comments Section ────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: TicketComment;
  currentUserId: number;
  currentRole: string;
  ticketId: number;
  onUpdated: (updated: TicketComment) => void;
  onDeleted: (id: number) => void;
}

function CommentItem({ comment, currentUserId, currentRole, ticketId, onUpdated, onDeleted }: CommentItemProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = comment.user_id === currentUserId;
  const isAdmin = currentRole === UserRole.ADMIN;
  const isManagerOrAdmin = currentRole === UserRole.MANAGER || currentRole === UserRole.ADMIN;

  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isManagerOrAdmin;

  const handleSave = async (): Promise<void> => {
    if (!editContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await commentsService.updateComment(ticketId, comment.id, editContent.trim());
      onUpdated(updated);
      setEditing(false);
    } catch {
      setError('Failed to save comment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await commentsService.deleteComment(ticketId, comment.id);
      onDeleted(comment.id);
    } catch {
      setError('Failed to delete comment.');
    }
  };

  const isEdited = comment.created_at !== comment.updated_at;

  return (
    <div className="group flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
        {comment.author_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{comment.author_name}</span>
          <span className="text-xs text-gray-400">
            {new Date(comment.created_at).toLocaleString('pl-PL')}
          </span>
          {isEdited && (
            <span className="text-xs text-gray-400 italic">(edited)</span>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving || !editContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(comment.content); setError(null); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { void handleDelete(); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentsProps {
  ticketId: number;
}

function CommentsSection({ ticketId }: CommentsProps): JSX.Element {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await commentsService.getComments(ticketId);
        setComments(data);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ticketId]);

  const handleSubmit = async (): Promise<void> => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await commentsService.createComment(ticketId, newContent.trim());
      setComments((prev) => [...prev, created]);
      setNewContent('');
    } catch {
      setSubmitError('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdated = (updated: TicketComment): void => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleted = (id: number): void => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  if (!user) return <></>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
      <h2 className="text-base font-semibold text-gray-900 mb-5">
        Comments
        <span className="ml-2 text-sm font-normal text-gray-400">({comments.length})</span>
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-5 mb-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user.id}
              currentRole={user.role}
              ticketId={ticketId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* New comment form */}
      <div className={`${comments.length > 0 ? 'border-t pt-5' : ''}`}>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  void handleSubmit();
                }
              }}
            />
            {submitError && <p className="text-red-500 text-xs mt-1">{submitError}</p>}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">⌘+Enter to submit</span>
              <button
                onClick={() => { void handleSubmit(); }}
                disabled={submitting || !newContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TicketDetail ─────────────────────────────────────────────────────────────

export function TicketDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async (): Promise<void> => {
      try {
        const t = await ticketsService.getTicketById(parseInt(id, 10));
        setTicket(t);
        setEditTitle(t.title);
        setEditDesc(t.description);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 403) {
          setPageError('You do not have permission to view this ticket.');
        } else {
          setPageError('Ticket not found.');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const isOwner = user && ticket && ticket.created_by === user.id;
  const canEdit = isOwner && ticket?.status === TicketStatus.OPEN && user?.role === UserRole.EMPLOYEE;
  const canChangeStatus = user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;
  const canDelete = user?.role === UserRole.ADMIN;

  const handleSaveEdit = async (): Promise<void> => {
    if (!ticket) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await ticketsService.updateTicket(ticket.id, {
        title: editTitle,
        description: editDesc,
      });
      setTicket(updated);
      setEditing(false);
    } catch {
      setActionError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: TicketStatus): Promise<void> => {
    if (!ticket) return;
    setActionError(null);
    try {
      const updated = await ticketsService.updateTicket(ticket.id, { status });
      setTicket(updated);
    } catch {
      setActionError('Failed to update status.');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!ticket || !window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) return;
    try {
      await ticketsService.deleteTicket(ticket.id);
      navigate('/tickets');
    } catch {
      setActionError('Failed to delete ticket.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-20 text-gray-400">Loading ticket...</div>
      </div>
    );
  }

  if (pageError || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto p-6 mt-12">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            {pageError ?? 'Ticket not found.'}
          </div>
          <button
            onClick={() => navigate('/tickets')}
            className="mt-4 text-blue-600 hover:underline text-sm"
          >
            ← Back to tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto p-6">
        <button
          onClick={() => navigate('/tickets')}
          className="text-blue-600 text-sm hover:underline mb-4 block"
        >
          ← Back to tickets
        </button>

        {actionError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {actionError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 break-words">{ticket.title}</h1>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {editing && (
                <>
                  <button
                    onClick={() => { void handleSaveEdit(); }}
                    disabled={saving}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditTitle(ticket.title); setEditDesc(ticket.description); }}
                    className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              {canDelete && !editing && (
                <button
                  onClick={() => { void handleDelete(); }}
                  className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-mono">
              #{ticket.id}
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {ticket.status.replace('_', ' ')}
            </span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
              {ticket.priority}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {ticket.department}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {ticket.category}
            </span>
          </div>

          <div className="border-t pt-5 mb-5">
            {editing ? (
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            )}
          </div>

          {canChangeStatus && !editing && (
            <div className="border-t pt-5">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Change Status
              </label>
              <select
                value={ticket.status}
                onChange={(e) => { void handleStatusChange(e.target.value as TicketStatus); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t mt-5 pt-4 text-xs text-gray-400 flex flex-wrap gap-4">
            <span>Created: {new Date(ticket.created_at).toLocaleString('pl-PL')}</span>
            <span>Updated: {new Date(ticket.updated_at).toLocaleString('pl-PL')}</span>
          </div>
        </div>

        <CommentsSection ticketId={ticket.id} />
      </main>
    </div>
  );
}
