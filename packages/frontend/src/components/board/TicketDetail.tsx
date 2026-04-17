import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useComments, useTicketNotes, useTransitionGates, useAgentSessions } from '../../api/queries.js';
import { useCreateComment, useMoveTicket, useDeleteTicket } from '../../api/mutations.js';
import { apiFetch } from '../../api/client.js';
import { getSocket, joinTicket, leaveTicket } from '../../api/socket.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { useBoardStore } from '../../stores/board-store.js';
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
    } catch (err) {
      console.error('Failed to update ticket:', err);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (status === ticket.status) return;
    try {
      await moveTicket.mutateAsync({ ticketId: ticket.id, toStatus: status });
      updateTicketStore(ticket.id, { status });
    } catch (err) {
      console.error('Failed to change ticket status:', err);
    }
  }

  async function handleDelete() {
    try {
      await deleteTicket.mutateAsync(ticket.id);
      removeTicketStore(ticket.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete ticket:', err);
    }
  }

  const epic = epics.find((e) => e.id === ticket.epicId);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gray-900 border-l border-gray-800 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded focus:outline-none focus:border-indigo-500 border border-transparent focus:bg-gray-600"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
            {epic && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: epic.color || '#6b7280' }} />
                {epic.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-gray-500 hover:text-red-400 text-sm"
              title="Delete ticket"
            >
              Delete
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Title + Description */}
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-indigo-500 h-32 resize-none"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400">Priority:</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-2 py-1 focus:outline-none"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm">
                    Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-300 px-3 py-1.5 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-white">{ticket.title}</h2>
                  <button
                    onClick={() => {
                      setEditTitle(ticket.title);
                      setEditDesc(ticket.description || '');
                      setEditPriority(ticket.priority);
                      setIsEditing(true);
                    }}
                    className="text-gray-500 hover:text-gray-300 text-xs shrink-0 ml-3"
                  >
                    Edit
                  </button>
                </div>
                {ticket.description ? (
                  <p className="text-gray-400 text-sm mt-2 whitespace-pre-wrap">{ticket.description}</p>
                ) : (
                  <p className="text-gray-600 text-sm mt-2 italic">No description</p>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-800 pt-4">
              <div>
                <span className="text-gray-500">Priority</span>
                <p className="text-white capitalize">{ticket.priority}</p>
              </div>
              <div>
                <span className="text-gray-500">Story Points</span>
                <p className="text-white">{ticket.storyPoints ?? '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Assigned Persona</span>
                <p className="text-indigo-400">{ticket.assignedPersona || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Created</span>
                <p className="text-white">{new Date(ticket.createdAt).toLocaleDateString()}</p>
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
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-white font-semibold mb-2">Delete Ticket</h3>
              <p className="text-gray-400 text-sm mb-4">
                Are you sure you want to delete "{ticket.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm"
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
