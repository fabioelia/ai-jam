import { useState, useEffect, useCallback } from 'react';
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

interface DependencySuggestion {
  ticketId: string;
  ticket: { id: string; title: string; status: string; priority: string };
  relationship: 'blocks' | 'blocked_by' | 'related';
  confidence: number;
  reason: string;
}

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

  // State for dependency suggestion UI
  const [suggestions, setSuggestions] = useState<DependencySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // State for story point estimation
  interface EstimationResult {
    points: number | null;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
    similarTickets: string[];
  }
  const [estimationResult, setEstimationResult] = useState<EstimationResult | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

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

  async function handleFindRelated() {
    setIsLoadingSuggestions(true);
    setSuggestionError(null);
    setAcceptedSuggestions([]);

    try {
      const response = await apiFetch('/projects/' + ticket.projectId + '/tickets/suggest-dependencies', {
        method: 'POST',
        body: JSON.stringify({ title: ticket.title, description: ticket.description, excludeTicketId: ticket.id }),
      });
      setSuggestions(response.suggestions ?? []);
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  function toggleAcceptSuggestion(ticketId: string) {
    setAcceptedSuggestions(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  }

  function dismissSuggestion(ticketId: string) {
    setSuggestions(prev => prev.filter(s => s.ticketId !== ticketId));
  }

  async function handleLinkAccepted() {
    if (acceptedSuggestions.length === 0) return;
    try {
      // Merge with existing dependencies
      const existingDeps = ticket.dependencies ?? [];
      const merged = [...new Set([...existingDeps, ...acceptedSuggestions])];
      await apiFetch(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dependencies: merged }),
      });
      updateTicketStore(ticket.id, { dependencies: merged });
      setSuggestions([]);
      setAcceptedSuggestions([]);
    } catch (err) {
      console.error('Failed to link dependencies:', err);
    }
  }

  async function handleEstimate() {
    setIsEstimating(true);
    setEstimateError(null);
    setEstimationResult(null);
    try {
      const result = await apiFetch(`/projects/${ticket.projectId}/tickets/${ticket.id}/estimate`, { method: 'POST' });
      setEstimationResult(result as EstimationResult);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Failed to estimate');
    } finally {
      setIsEstimating(false);
    }
  }

  async function handleApplyEstimate() {
    if (!estimationResult || estimationResult.points == null) return;
    try {
      await apiFetch(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ storyPoints: estimationResult.points }),
      });
      updateTicketStore(ticket.id, { storyPoints: estimationResult.points });
      setEstimationResult(null);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Failed to apply estimate');
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

            {/* Story Point Estimation */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-300">AI Estimation</h3>
                <button
                  onClick={handleEstimate}
                  disabled={isEstimating}
                  className="text-xs bg-indigo-600/80 hover:bg-indigo-500 disabled:bg-gray-700 text-white px-2 py-1 rounded transition-colors"
                >
                  {isEstimating ? 'Estimating...' : 'Estimate Points'}
                </button>
              </div>

              {estimateError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                  {estimateError}
                </div>
              )}

              {estimationResult && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 space-y-3">
                  {/* Points + Confidence */}
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white">
                        {estimationResult.points ?? '?'}
                      </div>
                      <div className="text-xs text-gray-500">points</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      estimationResult.confidence === 'high'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : estimationResult.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}>
                      {estimationResult.confidence} confidence
                    </span>
                  </div>

                  {/* Reasoning */}
                  <p className="text-sm text-gray-300">{estimationResult.reasoning}</p>

                  {/* Similar Tickets */}
                  {estimationResult.similarTickets.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Based on:</span>
                      <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                        {estimationResult.similarTickets.map((t, i) => (
                          <li key={i}>- {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Apply / Dismiss */}
                  <div className="flex gap-2">
                    {estimationResult.points != null && (
                      <button
                        onClick={handleApplyEstimate}
                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm"
                      >
                        Apply Estimate
                      </button>
                    )}
                    <button
                      onClick={() => setEstimationResult(null)}
                      className="text-gray-400 hover:text-gray-300 px-3 py-1.5 text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

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

            {/* Find Related Tickets */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Smart Dependencies</h3>
                <button
                  onClick={handleFindRelated}
                  disabled={isLoadingSuggestions}
                  className="text-xs bg-indigo-600/80 hover:bg-indigo-500 disabled:bg-gray-700 text-white px-2 py-1 rounded transition-colors"
                >
                  {isLoadingSuggestions ? 'Scanning...' : 'Find related tickets'}
                </button>
              </div>

              {suggestionError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                  {suggestionError}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map(s => {
                    const accepted = acceptedSuggestions.includes(s.ticketId);
                    const alreadyLinked = (ticket.dependencies ?? []).includes(s.ticketId);

                    return (
                      <div
                        key={s.ticketId}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2 border transition-colors ${
                          alreadyLinked
                            ? 'bg-gray-800/50 border-gray-700/50'
                            : accepted
                              ? 'bg-indigo-500/10 border-indigo-500/40'
                              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {!alreadyLinked && (
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={() => toggleAcceptSuggestion(s.ticketId)}
                            className="mt-1 w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {alreadyLinked ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-700/50">
                                linked
                              </span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700/50">
                                {s.relationship.replace('_', ' ')}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">{s.ticket.status}</span>
                          </div>
                          <p className="text-sm text-gray-200 truncate">{s.ticket.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{Math.round(s.confidence * 100)}%</span>
                          {!acceptedSuggestions.includes(s.ticketId) && !(ticket.dependencies ?? []).includes(s.ticketId) && (
                            <button
                              onClick={() => dismissSuggestion(s.ticketId)}
                              className="text-gray-500 hover:text-gray-300 text-xs px-1"
                            >
                              dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {acceptedSuggestions.length > 0 && (
                    <button
                      onClick={handleLinkAccepted}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm mt-2"
                    >
                      Link {acceptedSuggestions.length} selected dependency(s)
                    </button>
                  )}
                </div>
              )}
            </div>

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
