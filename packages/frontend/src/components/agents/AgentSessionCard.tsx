import { useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { toast } from '../../stores/toast-store.js';
import type { AgentSessionInfo } from '../../stores/agent-store.js';

const PERSONA_COLORS: Record<string, string> = {
  orchestrator: '#8b5cf6',
  implementer: '#34d399',
  reviewer: '#f59e0b',
  qa_tester: '#f97316',
  acceptance_validator: '#a855f7',
  planner: '#6366f1',
  developer: '#10b981',
  product: '#ec4899',
  business_rules: '#14b8a6',
  qa: '#f97316',
  researcher: '#06b6d4',
};

const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
  busy: { label: 'Working', color: 'text-green-400' },
  waiting: { label: 'Waiting', color: 'text-yellow-400' },
  idle: { label: 'Idle', color: 'text-gray-500' },
};

interface AgentSessionCardProps {
  session: AgentSessionInfo;
}

export default function AgentSessionCard({ session }: AgentSessionCardProps) {
  const color = PERSONA_COLORS[session.personaType] || '#6b7280';
  const activityInfo = ACTIVITY_LABELS[session.activity] || ACTIVITY_LABELS.idle;
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await apiFetch(`/agent-sessions/${session.sessionId}/retry`, { method: 'POST' });
      toast.info(`Retrying ${session.personaType.replace(/_/g, ' ')} session...`);
    } catch (err) {
      toast.error(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={`bg-gray-800 border rounded-lg p-3 ${session.status === 'failed' ? 'border-red-800' : 'border-gray-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-white capitalize">
          {session.personaType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs ml-auto ${session.status === 'failed' ? 'text-red-400' : activityInfo.color}`}>
          {session.status === 'running' && session.activity === 'busy' && (
            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse" />
          )}
          {session.status === 'completed' ? 'Done' : session.status === 'failed' ? 'Failed' : activityInfo.label}
        </span>
      </div>

      {session.summary && (
        <p className={`text-xs line-clamp-2 ${session.status === 'failed' ? 'text-red-400/80' : 'text-gray-400'}`}>
          {session.summary}
        </p>
      )}

      {session.status === 'running' && session.outputChunks.length > 0 && (
        <div className="mt-2 bg-gray-900 rounded p-2 max-h-20 overflow-y-auto">
          <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono">
            {session.outputChunks.slice(-5).join('')}
          </pre>
        </div>
      )}

      {session.status === 'failed' && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-2 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 px-2.5 py-1 rounded border border-red-700/50 disabled:opacity-50"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      )}
    </div>
  );
}
