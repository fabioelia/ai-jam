import { useState, useEffect } from 'react';
import { useComments, useTicketNotes, useTransitionGates, useAgentSessions, useDependencyChain } from '../../api/queries.js';
import { useCreateComment } from '../../api/mutations.js';
import { apiFetch } from '../../api/client.js';
import { getSocket, joinTicket, leaveTicket } from '../../api/socket.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { useBoardStore } from '../../stores/board-store.js';
import CommentThread from './CommentThread.js';
import HandoffTimeline from './HandoffTimeline.js';
import DependencyChain from './DependencyChain.js';
import type { Ticket, Epic, Comment, TicketPriority } from '@ai-jam/shared';

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  qa: 'QA',
  acceptance: 'Acceptance',
  done: 'Done',
};

const PRIORITY_OPTIONS: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

interface TicketDetailProps {
  ticket: Ticket;
  epics: Epic[];
  onClose: () => void;
}

export default function TicketDetail({ ticket, epics, onClose }: TicketDetailProps) {
  const user = useAuthStore((s) => s.user);
  const updateTicketStore = useBoardStore((s) => s.updateTicket);
  const { data: serverComments, refetch: refetchComments } = useComments(ticket.id);
  const createComment = useCreateComment(ticket.id);
  const { data: ticketNotes } = useTicketNotes(ticket.id);
  const { data: transitionGates } = useTransitionGates(ticket.id);
  const { data: agentSessionsData } = useAgentSessions(ticket.id);
  const { data: dependencyChain } = useDependencyChain(ticket.id, 5);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDesc, setEditDesc] = useState(ticket.description || '');
  const [editPriority, setEditPriority] = useState(ticket.priority);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  // State for tracking which ticket is currently displayed in the detail view
  const [currentTicketId, setCurrentTicketId] = useState(ticket.id);

  // Sync server comments
  useEffect(() => {
    if (serverComments) setComments(serverComments);
  }, [serverComments]);

  // Check if ticket is blocked by dependencies
  useEffect(() => {
    async function checkBlockedStatus() {
      if (ticket.dependencies && ticket.dependencies.length > 0) {
        try {
          const response = await apiFetch(`/tickets/${ticket.id}/blocked-status`);
          setIsBlocked(response.blocked);
        } catch (err) {
          console.error('Failed to check blocked status:', err);
        }
      }
    }
    checkBlockedStatus();
  }, [ticket.id, ticket.dependencies]);

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
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            {epic && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: epic.color || '#6b7280' }} />
                {epic.title}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
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

            {/* Dependencies */}
            {ticket.dependencies && ticket.dependencies.length > 0 && (
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  🔗 Dependencies ({ticket.dependencies.length})
                </h3>
                {isBlocked ? (
                  <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                    <span className="shrink-0">⚠️</span>
                    <span>This ticket is blocked by incomplete dependencies.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                    <span className="shrink-0">✅</span>
                    <span>All dependencies are complete. This ticket is ready to start.</span>
                  </div>
                )}
              </div>
            )}

            {/* Dependency Chain */}
            {(dependencyChain && (dependencyChain.upstream.length > 0 || dependencyChain.downstream.length > 0)) && (
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Dependency Chain
                </h3>
                <DependencyChain
                  chain={dependencyChain}
                  onTicketClick={(ticketId) => {
                    // Open the clicked ticket in the detail view
                    apiFetch<Ticket>(`/tickets/${ticketId}`)
                      .then((clickedTicket) => {
                        setCurrentTicketId(ticketId);
                        // Note: This would require restructuring to support navigation
                        // For now, we could emit an event or use a callback
                        console.log('Navigate to ticket:', clickedTicket);
                      })
                      .catch((err) => {
                        console.error('Failed to load ticket:', err);
                      });
                  }}
                />
              </div>
            )}

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
      </div>
    </>
  );
}
