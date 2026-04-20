import { useState } from 'react';
import type { Ticket, TicketNote, TransitionGate, Comment, TicketStatus, TicketPriority } from '@ai-jam/shared';

interface TicketHistoryProps {
  ticket: Ticket;
  notes: TicketNote[];
  gates: TransitionGate[];
  comments: Comment[];
  agentSessions?: Array<{
    id: string;
    personaType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    outputSummary: string | null;
  }>;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  type: 'status_change' | 'priority_change' | 'assignment_change' | 'field_update' | 'comment' | 'handoff' | 'gate' | 'session';
  user?: string;
  description: string;
  details?: string;
  changes?: Record<string, { from: string | number | null; to: string | number | null }>;
}

export default function TicketHistory({ ticket, notes, gates, comments, agentSessions = [] }: TicketHistoryProps) {
  const [filter, setFilter] = useState<string>('all');

  // Build comprehensive history timeline
  const buildHistory = (): HistoryItem[] => {
    const items: HistoryItem[] = [];

    // Add ticket creation
    items.push({
      id: 'creation',
      timestamp: ticket.createdAt,
      type: 'field_update',
      user: 'System',
      description: 'Ticket created',
      details: `Created by user ${ticket.createdBy}`,
    });

    // Add comments
    comments.forEach((comment) => {
      items.push({
        id: `comment-${comment.id}`,
        timestamp: comment.createdAt,
        type: 'comment',
        user: comment.userId,
        description: 'Comment added',
        details: comment.body,
      });
    });

    // Add handoffs from notes
    notes.forEach((note) => {
      if (note.handoffFrom || note.handoffTo) {
        items.push({
          id: `handoff-${note.id}`,
          timestamp: note.createdAt,
          type: 'handoff',
          user: note.authorId,
          description: 'Agent handoff',
          details: `${note.handoffFrom?.replace(/_/g, ' ')} → ${note.handoffTo?.replace(/_/g, ' ')}`,
        });
      }
    });

    // Add transition gates
    gates.forEach((gate) => {
      items.push({
        id: `gate-${gate.id}`,
        timestamp: gate.createdAt,
        type: 'gate',
        user: gate.gatekeeperPersona,
        description: `Transition gate: ${gate.fromStatus} → ${gate.toStatus}`,
        details: gate.feedback ? `Result: ${gate.result}. ${gate.feedback}` : `Result: ${gate.result}`,
      });
    });

    // Add agent sessions
    agentSessions.forEach((session) => {
      items.push({
        id: `session-${session.id}`,
        timestamp: session.startedAt || session.completedAt || '',
        type: 'session',
        user: session.personaType,
        description: `Agent session: ${session.status}`,
        details: session.outputSummary || undefined,
      });
    });

    // Sort by timestamp (newest first)
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const history = buildHistory();

  const filterTypes = [
    { key: 'all', label: 'All' },
    { key: 'status_change', label: 'Status Changes' },
    { key: 'priority_change', label: 'Priority' },
    { key: 'assignment_change', label: 'Assignments' },
    { key: 'comment', label: 'Comments' },
    { key: 'handoff', label: 'Handoffs' },
    { key: 'gate', label: 'Gates' },
    { key: 'session', label: 'Agent Sessions' },
  ];

  const filteredHistory = filter === 'all' ? history : history.filter(item => item.type === filter);

  const getTypeConfig = (type: HistoryItem['type']) => {
    const configs: Record<HistoryItem['type'], { icon: string; color: string; bg: string }> = {
      status_change: { icon: '🔄', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      priority_change: { icon: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/10' },
      assignment_change: { icon: '👤', color: 'text-purple-400', bg: 'bg-purple-500/10' },
      field_update: { icon: '✏️', color: 'text-gray-400', bg: 'bg-gray-500/10' },
      comment: { icon: '💬', color: 'text-green-400', bg: 'bg-green-500/10' },
      handoff: { icon: '🤝', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      gate: { icon: '🚪', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
      session: { icon: '🤖', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    };
    return configs[type];
  };

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {filterTypes.map((ft) => (
          <button
            key={ft.key}
            onClick={() => setFilter(ft.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === ft.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filteredHistory.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center animate-in fade-in duration-300">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-200">
              <svg className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 italic animate-in fade-in duration-300 delay-200">No history recorded yet</p>
          </div>
        </div>
      ) : (
        <div className="relative space-y-4">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-700" />

          {filteredHistory.map((item, index) => {
            const config = getTypeConfig(item.type);
            const timeStr = new Date(item.timestamp).toLocaleString();

            return (
              <div key={item.id} className="relative flex gap-4 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center ring-2 ring-gray-900`}>
                    <span className="text-sm">{config.icon}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:bg-gray-800 hover:shadow-sm hover:shadow-gray-900/10 transition-all duration-200">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`text-sm font-medium ${config.color}`}>{item.description}</h4>
                    <span className="text-xs text-gray-600 whitespace-nowrap">{timeStr}</span>
                  </div>

                  {item.user && (
                    <p className="text-xs text-gray-500 mb-1">By {item.user}</p>
                  )}

                  {item.details && (
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">{item.details}</p>
                  )}

                  {item.changes && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(item.changes).map(([field, change]) => (
                        <div key={field} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 capitalize">{field.replace(/_/g, ' ')}:</span>
                          <span className="text-red-400 line-through">{String(change.from)}</span>
                          <span className="text-gray-600">→</span>
                          <span className="text-green-400">{String(change.to)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
