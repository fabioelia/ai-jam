import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useComments, useTicketNotes, useTransitionGates, useAgentSessions } from '../../api/queries.js';
import { useCreateComment, useMoveTicket, useDeleteTicket } from '../../api/mutations.js';
import { apiFetch, getClientErrorMessage } from '../../api/client.js';
import { getSocket, joinTicket, leaveTicket } from '../../api/socket.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { useBoardStore } from '../../stores/board-store.js';
import { toast } from '../../stores/toast-store.js';
import CommentThread from './CommentThread.js';
import HandoffTimeline from './HandoffTimeline.js';
import type { Ticket, Epic, Comment, TicketPriority, TicketStatus } from '@ai-jam/shared';

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  qa: 'QA',
  acceptance: 'Acceptance',
  done: 'Done',
};

const STATUS_OPTIONS: TicketStatus[] = ['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done'];

const PRIORITY_OPTIONS: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

interface TicketDetailProps {
  ticket: Ticket;
  epics: Epic[];
  onClose: () => void;
}

export default function TicketDetail({ ticket, epics, onClose }: TicketDetailProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const user = useAuthStore((s) => s.user);
  const updateTicketStore = useBoardStore((s) => s.updateTicket);
  const removeTicketStore = useBoardStore((s) => s.removeTicket);
  const { data: serverComments, refetch: refetchComments } = useComments(ticket.id);
  const createComment = useCreateComment(ticket.id);
  const { data: ticketNotes } = useTicketNotes(ticket.id);
  const { data: transitionGates } = useTransitionGates(ticket.id);
  const { data: agentSessionsData } = useAgentSessions(ticket.id);
  const moveTicket = useMoveTicket(projectId!);
  const deleteTicket = useDeleteTicket(projectId!);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDesc, setEditDesc] = useState(ticket.description || '');
  const [editPriority, setEditPriority] = useState(ticket.priority);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDeleteConfirm, isEditing]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
    }
  }, [isEditing]);

  // Sync server comments
  useEffect(() => {
    if (serverComments) setComments(serverComments);
  }, [serverComments]);

  // Real-time comment updates
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    joinTicket(ticket.id);

    const handler = ({ comment }: { comment: Comment }) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    };

    socket.on('comment:created', handler);

    return () => {
      leaveTicket(ticket.id);
      socket.off('comment:created', handler);
    };
  }, [ticket.id]);

  async function handleSaveEdit() {
    try {
      await apiFetch(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          description: editDesc || null,
          priority: editPriority,
        }),
      });
      updateTicketStore(ticket.id, {
        title: editTitle,
        description: editDesc || null,
        priority: editPriority,
      });
      setIsEditing(false);
      toast.success('Ticket updated successfully');
    } catch (err) {
      toast.error(`Failed to update ticket: ${getClientErrorMessage(err)}`);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (status === ticket.status) return;
    try {
      await moveTicket.mutateAsync({ ticketId: ticket.id, toStatus: status });
      updateTicketStore(ticket.id, { status });
      toast.success(`Ticket moved to ${STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(`Failed to move ticket: ${getClientErrorMessage(err)}`);
    }
  }

  async function handleDelete() {
    try {
      await deleteTicket.mutateAsync(ticket.id);
      removeTicketStore(ticket.id);
      toast.success('Ticket deleted');
      onClose();
    } catch (err) {
      toast.error(`Failed to delete ticket: ${getClientErrorMessage(err)}`);
    }
  }

  const epic = epics.find((e) => e.id === ticket.epicId);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] max-w-full sm:max-w-lg bg-gray-900 border-l border-gray-800 z-50 flex flex-col overflow-hidden animate-in slide-in-from-right shadow-2xl shadow-black/50"
        role="dialog"
        aria-label="Ticket details"
      >
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800 flex items-center justify-between shrink-0 bg-gray-900/95 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="text-xs bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 border border-transparent focus:bg-gray-600 transition-all cursor-pointer"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
            {epic && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-full truncate">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: epic.color || '#6b7280' }} />
                <span className="truncate">{epic.title}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors text-sm"
              title="Delete ticket"
              aria-label="Delete ticket"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-4 md:py-5 space-y-4 md:space-y-5">
            {/* Title + Description */}
            {isEditing ? (
              <div className="space-y-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 animate-in fade-in-up duration-200">
                <div>
                  <label htmlFor="ticket-title" className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
                  <input
                    ref={titleInputRef}
                    id="ticket-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="ticket-desc" className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                  <textarea
                    id="ticket-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Describe the task..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all h-28 resize-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="ticket-priority" className="text-sm text-gray-400">Priority:</label>
                  <select
                    id="ticket-priority"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editTitle.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-gray-400 hover:text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-sm transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-xl font-semibold text-white">{ticket.title}</h2>
                  <button
                    onClick={() => {
                      setEditTitle(ticket.title);
                      setEditDesc(ticket.description || '');
                      setEditPriority(ticket.priority);
                      setIsEditing(true);
                    }}
                    className="text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2h2.828l-8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                </div>
                {ticket.description ? (
                  <p className="text-gray-400 text-sm mt-3 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                ) : (
                  <p className="text-gray-600 text-sm mt-3 italic">No description</p>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-800 pt-4">
              <div className="bg-gray-800/30 rounded-lg p-3">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Priority</span>
                <p className="text-white capitalize mt-1 font-medium">{ticket.priority}</p>
              </div>
              <div className="bg-gray-800/30 rounded-lg p-3">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Story Points</span>
                <p className="text-white mt-1 font-medium">{ticket.storyPoints ?? '-'}</p>
              </div>
              <div className="bg-gray-800/30 rounded-lg p-3">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Assigned Persona</span>
                <p className="text-indigo-400 mt-1 font-medium">{ticket.assignedPersona || '-'}</p>
              </div>
              <div className="bg-gray-800/30 rounded-lg p-3">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Created</span>
                <p className="text-white mt-1 font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Agent Activity / Handoff Timeline */}
            {(ticketNotes?.length || transitionGates?.length || agentSessionsData?.length) ? (
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Agent Activity
                </h3>
                <HandoffTimeline
                  notes={ticketNotes || []}
                  gates={transitionGates || []}
                  sessions={agentSessionsData || []}
                />
              </div>
            ) : null}

            {/* Comments */}
            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Comments ({comments.length})
              </h3>
              <CommentThread
                comments={comments}
                currentUserId={user?.id || ''}
                onAddComment={async (body) => {
                  await createComment.mutateAsync({ body });
                }}
              />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-150 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-150 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-base">Delete Ticket</h3>
              </div>
              <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-medium">"{ticket.title}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
