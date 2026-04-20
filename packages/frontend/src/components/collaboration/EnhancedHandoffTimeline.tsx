import { useState, useMemo, useCallback } from 'react';
import type { TicketNote, TransitionGate, AgentSession } from '@ai-jam/shared';

interface EnhancedHandoffTimelineProps {
  notes: TicketNote[];
  gates: TransitionGate[];
  sessions: Array<{
    id: string;
    personaType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    outputSummary: string | null;
  }>;
  onNoteClick?: (noteId: string) => void;
  onGateClick?: (gateId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  showDetails?: boolean;
  animateNew?: boolean;
}

type TimelineItem =
  | { type: 'handoff'; note: TicketNote; timestamp: string }
  | { type: 'gate'; gate: TransitionGate; timestamp: string }
  | { type: 'session'; session: EnhancedHandoffTimelineProps['sessions'][0]; timestamp: string };

type ViewMode = 'compact' | 'detailed' | 'expanded';

const GATE_RESULT_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    label: 'Pending',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  approved: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    label: 'Approved',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  rejected: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    label: 'Rejected',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
};

const PERSONA_COLORS: Record<string, string> = {
  orchestrator: '#8b5cf6',
  implementer: '#34d399',
  reviewer: '#f59e0b',
  qa_tester: '#f97316',
  acceptance_validator: '#a855f7',
  planner: '#6366f1',
  developer: '#22d3ee',
  product: '#f472b6',
  business_rules: '#fb923c',
  qa: '#a3e635',
  researcher: '#60a5fa',
};

const PERSONA_ICONS: Record<string, string> = {
  orchestrator: '🎯',
  implementer: '🔧',
  reviewer: '👁️',
  qa_tester: '🔍',
  acceptance_validator: '✅',
  planner: '📋',
  developer: '💻',
  product: '📱',
  business_rules: '📊',
  qa: '✨',
  researcher: '🔬',
};

export default function EnhancedHandoffTimeline({
  notes,
  gates,
  sessions,
  onNoteClick,
  onGateClick,
  onSessionClick,
  showDetails = true,
  animateNew = false,
}: EnhancedHandoffTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Merge all items into a chronological timeline
  const items: TimelineItem[] = useMemo(() => [
    ...notes
      .filter((n) => n.handoffFrom || n.handoffTo)
      .map((n) => ({ type: 'handoff' as const, note: n, timestamp: n.createdAt })),
    ...gates.map((g) => ({ type: 'gate' as const, gate: g, timestamp: g.createdAt })),
    ...sessions.map((s) => ({
      type: 'session' as const,
      session: s,
      timestamp: s.startedAt || s.completedAt || '',
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [notes, gates, sessions]);

  // Calculate session duration
  const getSessionDuration = useCallback((session: EnhancedHandoffTimelineProps['sessions'][0]) => {
    if (!session.startedAt || !session.completedAt) return null;
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.completedAt).getTime();
    const duration = end - start;

    if (duration < 60000) return `${Math.floor(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
    return `${Math.floor(duration / 3600000)}h ${Math.floor((duration % 3600000) / 60000)}m`;
  }, []);

  // Toggle item expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Get timeline stats
  const stats = useMemo(() => {
    const handoffs = items.filter((i) => i.type === 'handoff').length;
    const gates = items.filter((i) => i.type === 'gate').length;
    const sessions = items.filter((i) => i.type === 'session').length;
    const approvedGates = gates.filter((i) => i.type === 'gate' && (i as { type: 'gate'; gate: TransitionGate }).gate.result === 'approved').length;
    const rejectedGates = gates.filter((i) => i.type === 'gate' && (i as { type: 'gate'; gate: TransitionGate }).gate.result === 'rejected').length;

    return {
      handoffs,
      gates,
      sessions,
      approvedGates,
      rejectedGates,
      successRate: gates > 0 ? ((approvedGates / gates) * 100).toFixed(1) : '0',
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-200">
            <svg className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 italic animate-in fade-in duration-300 delay-200">No agent activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Agent Activity Timeline</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('compact')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              viewMode === 'compact'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            }`}
          >
            Compact
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              viewMode === 'detailed'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            }`}
          >
            Detailed
          </button>
          <button
            onClick={() => setViewMode('expanded')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              viewMode === 'expanded'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            }`}
          >
            Expanded
          </button>
        </div>
      </div>

      {/* Timeline Stats */}
      {viewMode === 'detailed' || viewMode === 'expanded' ? (
        <div className="bg-gray-800/30 rounded-lg p-3 grid grid-cols-5 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{stats.handoffs}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Handoffs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">{stats.gates}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Gates</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400">{stats.sessions}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">{stats.successRate}%</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Success Rate</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">{stats.rejectedGates}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rejections</p>
          </div>
        </div>
      ) : null}

      {/* Timeline */}
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500" />

        {items.map((item, index) => (
          <div
            key={`${item.type}-${item.type === 'handoff' ? item.note.id : item.type === 'gate' ? item.gate.id : item.session.id}`}
            className={`
              relative flex gap-3 py-3
              ${animateNew ? 'animate-in slide-in-from-right duration-300' : ''}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Dot */}
            <div className="relative z-10 mt-1">
              {item.type === 'handoff' ? (
                <div
                  className={`
                    w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                    ring-4 ring-gray-900 ml-1 cursor-pointer transition-all hover:scale-110
                    ${selectedItem === `handoff-${item.note.id}` ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900' : ''}
                  `}
                  onClick={() => {
                    setSelectedItem(`handoff-${item.note.id}`);
                    onNoteClick?.(item.note.id);
                  }}
                />
              ) : item.type === 'gate' ? (
                <div
                  className={`
                    w-4 h-4 rounded-full ring-4 ring-gray-900 ml-1 cursor-pointer transition-all hover:scale-110
                    ${item.gate.result === 'approved' ? 'bg-green-500' : item.gate.result === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}
                    ${selectedItem === `gate-${item.gate.id}` ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900' : ''}
                  `}
                  onClick={() => {
                    setSelectedItem(`gate-${item.gate.id}`);
                    onGateClick?.(item.gate.id);
                  }}
                />
              ) : (
                <div
                  className={`
                    w-4 h-4 rounded-full ring-4 ring-gray-900 ml-1 cursor-pointer transition-all hover:scale-110
                    ${item.session.status === 'running' ? 'animate-pulse' : ''}
                  `}
                  style={{ backgroundColor: PERSONA_COLORS[item.session.personaType] || '#6b7280' }}
                  onClick={() => {
                    setSelectedItem(`session-${item.session.id}`);
                    onSessionClick?.(item.session.id);
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {item.type === 'handoff' && (
                <HandoffEntry
                  note={item.note}
                  viewMode={viewMode}
                  isSelected={selectedItem === `handoff-${item.note.id}`}
                  onToggleExpand={() => toggleExpand(`handoff-${item.note.id}`)}
                  isExpanded={expandedItems.has(`handoff-${item.note.id}`)}
                />
              )}
              {item.type === 'gate' && (
                <GateEntry
                  gate={item.gate}
                  viewMode={viewMode}
                  isSelected={selectedItem === `gate-${item.gate.id}`}
                  onToggleExpand={() => toggleExpand(`gate-${item.gate.id}`)}
                  isExpanded={expandedItems.has(`gate-${item.gate.id}`)}
                />
              )}
              {item.type === 'session' && (
                <SessionEntry
                  session={item.session}
                  viewMode={viewMode}
                  isSelected={selectedItem === `session-${item.session.id}`}
                  onToggleExpand={() => toggleExpand(`session-${item.session.id}`)}
                  isExpanded={expandedItems.has(`session-${item.session.id}`)}
                  getDuration={getSessionDuration}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HandoffEntryProps {
  note: TicketNote;
  viewMode: ViewMode;
  isSelected: boolean;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

function HandoffEntry({ note, viewMode, isSelected, onToggleExpand, isExpanded }: HandoffEntryProps) {
  const showFullContent = viewMode === 'expanded' || isExpanded;

  return (
    <div
      className={`
        ${viewMode === 'compact' ? 'text-xs' : ''}
        ${isSelected ? 'bg-indigo-500/10 rounded-lg px-3 py-2' : ''}
      `}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-indigo-400 flex items-center gap-1">
          {note.handoffFrom?.replace(/_/g, ' ')} &rarr; {note.handoffTo?.replace(/_/g, ' ')}
        </span>
        <span className="text-gray-600">
          {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {showFullContent && note.content && (
        <p className="text-gray-400 mt-2 line-clamp-3 whitespace-pre-wrap">
          {note.content}
        </p>
      )}
      {viewMode === 'detailed' && !isExpanded && note.content && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1"
        >
          <span>Show more</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface GateEntryProps {
  gate: TransitionGate;
  viewMode: ViewMode;
  isSelected: boolean;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

function GateEntry({ gate, viewMode, isSelected, onToggleExpand, isExpanded }: GateEntryProps) {
  const style = GATE_RESULT_STYLES[gate.result] || GATE_RESULT_STYLES.pending;
  const showDetails = viewMode === 'expanded' || isExpanded;

  return (
    <div
      className={`
        ${viewMode === 'compact' ? 'text-xs' : ''}
        ${isSelected ? 'bg-indigo-500/10 rounded-lg px-3 py-2' : ''}
      `}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-gray-300">
          Gate: {gate.fromStatus} &rarr; {gate.toStatus}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${style.bg} ${style.text}`}>
          {style.icon}
          {style.label}
        </span>
        <span className="text-gray-600 text-xs">
          {gate.gatekeeperPersona.replace(/_/g, ' ')}
        </span>
        <span className="text-gray-600">
          {new Date(gate.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {showDetails && gate.feedback && (
        <p className="text-red-400/80 mt-2 text-sm line-clamp-2">
          {gate.feedback}
        </p>
      )}
      {viewMode === 'detailed' && !isExpanded && gate.feedback && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1"
        >
          <span>Show more</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface SessionEntryProps {
  session: EnhancedHandoffTimelineProps['sessions'][0];
  viewMode: ViewMode;
  isSelected: boolean;
  onToggleExpand: () => void;
  isExpanded: boolean;
  getDuration: (session: EnhancedHandoffTimelineProps['sessions'][0]) => string | null;
}

function SessionEntry({ session, viewMode, isSelected, onToggleExpand, isExpanded, getDuration }: SessionEntryProps) {
  const isRunning = session.status === 'running';
  const isFailed = session.status === 'failed';
  const isCompleted = session.status === 'completed';
  const personaColor = PERSONA_COLORS[session.personaType] || '#6b7280';
  const personaIcon = PERSONA_ICONS[session.personaType] || '🤖';
  const showDetails = viewMode === 'expanded' || isExpanded;

  return (
    <div
      className={`
        ${viewMode === 'compact' ? 'text-xs' : ''}
        ${isSelected ? 'bg-indigo-500/10 rounded-lg px-3 py-2' : ''}
      `}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">{personaIcon}</span>
        <span className="font-medium text-gray-300 capitalize">
          {session.personaType.replace(/_/g, ' ')}
        </span>
        <span className={`
          px-2 py-0.5 rounded text-xs flex items-center gap-1
          ${isRunning ? 'bg-green-500/20 text-green-400' : isFailed ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}
        `}>
          {isRunning && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />}
          {session.status}
        </span>
        {session.startedAt && (
          <span className="text-gray-600 text-xs">
            {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {getDuration(session) && (
          <span className="text-gray-500 text-xs">
            {getDuration(session)}
          </span>
        )}
      </div>
      {showDetails && session.outputSummary && (
        <p className="text-gray-400 mt-2 text-sm line-clamp-3">
          {session.outputSummary}
        </p>
      )}
      {viewMode === 'detailed' && !isExpanded && session.outputSummary && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1"
        >
          <span>Show more</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
