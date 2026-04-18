import type { TicketNote, TransitionGate } from '@ai-jam/shared';

const GATE_RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Approved' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
};

const PERSONA_COLORS: Record<string, string> = {
  orchestrator: '#8b5cf6',
  implementer: '#34d399',
  reviewer: '#f59e0b',
  qa_tester: '#f97316',
  acceptance_validator: '#a855f7',
  planner: '#6366f1',
};

interface HandoffTimelineProps {
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
}

type TimelineItem =
  | { type: 'handoff'; note: TicketNote; timestamp: string }
  | { type: 'gate'; gate: TransitionGate; timestamp: string }
  | { type: 'session'; session: HandoffTimelineProps['sessions'][0]; timestamp: string };

export default function HandoffTimeline({ notes, gates, sessions }: HandoffTimelineProps) {
  // Merge all items into a chronological timeline
  const items: TimelineItem[] = [
    ...notes
      .filter((n) => n.handoffFrom || n.handoffTo)
      .map((n) => ({ type: 'handoff' as const, note: n, timestamp: n.createdAt })),
    ...gates.map((g) => ({ type: 'gate' as const, gate: g, timestamp: g.createdAt })),
    ...sessions.map((s) => ({
      type: 'session' as const,
      session: s,
      timestamp: s.startedAt || s.completedAt || '',
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center animate-in fade-in duration-300">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2 animate-in scale-in duration-200">
            <svg className="w-5 h-5 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 italic animate-in fade-in duration-300 delay-200">No agent activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-700" />

      {items.map((item, i) => (
        <div key={i} className="relative flex gap-3 py-2">
          {/* Dot */}
          <div className="relative z-10 mt-1">
            {item.type === 'handoff' ? (
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-gray-900 ml-[5px]" />
            ) : item.type === 'gate' ? (
              <div
                className={`w-2.5 h-2.5 rounded-full ring-2 ring-gray-900 ml-[5px] ${
                  item.gate.result === 'approved' ? 'bg-green-500' : item.gate.result === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
              />
            ) : (
              <div
                className="w-2.5 h-2.5 rounded-full ring-2 ring-gray-900 ml-[5px]"
                style={{ backgroundColor: PERSONA_COLORS[item.session.personaType] || '#6b7280' }}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {item.type === 'handoff' && <HandoffEntry note={item.note} />}
            {item.type === 'gate' && <GateEntry gate={item.gate} />}
            {item.type === 'session' && <SessionEntry session={item.session} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function HandoffEntry({ note }: { note: TicketNote }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-indigo-400">
          {note.handoffFrom?.replace(/_/g, ' ')} &rarr; {note.handoffTo?.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-gray-600">
          {new Date(note.createdAt).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-0.5 line-clamp-3 whitespace-pre-wrap">
        {note.content.slice(0, 300)}
      </p>
    </div>
  );
}

function GateEntry({ gate }: { gate: TransitionGate }) {
  const style = GATE_RESULT_STYLES[gate.result] || GATE_RESULT_STYLES.pending;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-300">
          Gate: {gate.fromStatus} &rarr; {gate.toStatus}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        <span className="text-xs text-gray-600">
          {gate.gatekeeperPersona.replace(/_/g, ' ')}
        </span>
      </div>
      {gate.feedback && (
        <p className="text-xs text-red-400/80 mt-0.5 line-clamp-2">{gate.feedback}</p>
      )}
    </div>
  );
}

function SessionEntry({ session }: { session: HandoffTimelineProps['sessions'][0] }) {
  const isRunning = session.status === 'running';
  const isFailed = session.status === 'failed';

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-300 capitalize">
          {session.personaType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs ${isRunning ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-gray-500'}`}>
          {isRunning && <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse" />}
          {session.status}
        </span>
        {session.startedAt && (
          <span className="text-xs text-gray-600">
            {new Date(session.startedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      {session.outputSummary && (
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{session.outputSummary}</p>
      )}
    </div>
  );
}
