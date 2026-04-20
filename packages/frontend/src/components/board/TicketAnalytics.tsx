import type { Ticket, TicketNote, TransitionGate } from '@ai-jam/shared';

interface TicketAnalyticsProps {
  ticket: Ticket;
  notes: TicketNote[];
  gates: TransitionGate[];
  agentSessions?: Array<{
    id: string;
    personaType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    iterations?: number;
    tokensUsed?: number;
  }>;
}

interface MetricCard {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  icon: string;
  color: string;
}

export default function TicketAnalytics({ ticket, notes, gates, agentSessions = [] }: TicketAnalyticsProps) {
  // Calculate metrics
  const calculateMetrics = (): MetricCard[] => {
    const metrics: MetricCard[] = [];

    // Time since creation
    const createdAt = new Date(ticket.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    metrics.push({
      label: 'Days Active',
      value: daysSinceCreation,
      icon: '📅',
      color: 'text-blue-400',
    });

    // Agent sessions count
    const sessionCount = agentSessions.length;
    metrics.push({
      label: 'Agent Sessions',
      value: sessionCount,
      icon: '🤖',
      color: 'text-purple-400',
    });

    // Total iterations
    const totalIterations = agentSessions.reduce((sum, s) => sum + (s.iterations || 0), 0);
    metrics.push({
      label: 'Total Iterations',
      value: totalIterations,
      icon: '🔄',
      color: 'text-green-400',
    });

    // Tokens used
    const totalTokens = agentSessions.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);
    metrics.push({
      label: 'Tokens Used',
      value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens,
      icon: '📊',
      color: 'text-orange-400',
    });

    // Comments count
    metrics.push({
      label: 'Comments',
      value: 0, // Will be updated from parent
      icon: '💬',
      color: 'text-cyan-400',
    });

    // Handoffs count
    const handoffCount = notes.filter(n => n.handoffFrom || n.handoffTo).length;
    metrics.push({
      label: 'Handoffs',
      value: handoffCount,
      icon: '🤝',
      color: 'text-pink-400',
    });

    // Gates passed/failed
    const passedGates = gates.filter(g => g.result === 'approved').length;
    const failedGates = gates.filter(g => g.result === 'rejected').length;
    metrics.push({
      label: 'Gates Passed',
      value: `${passedGates}/${gates.length}`,
      icon: '🚪',
      color: passedGates === gates.length && gates.length > 0 ? 'text-green-400' : 'text-yellow-400',
    });

    // Active time (sum of session durations)
    const activeTimeMinutes = agentSessions.reduce((sum, s) => {
      if (s.startedAt && s.completedAt) {
        return sum + (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60);
      }
      return sum;
    }, 0);
    metrics.push({
      label: 'Active Time',
      value: activeTimeMinutes > 60 ? `${(activeTimeMinutes / 60).toFixed(1)}h` : `${Math.floor(activeTimeMinutes)}m`,
      icon: '⏱️',
      color: 'text-emerald-400',
    });

    return metrics;
  };

  const metrics = calculateMetrics();

  // Calculate status progression
  const getStatusProgression = () => {
    const statusOrder = ['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done'];
    const currentIndex = statusOrder.indexOf(ticket.status);
    return {
      progress: (currentIndex / (statusOrder.length - 1)) * 100,
      currentIndex,
      totalStages: statusOrder.length,
    };
  };

  const statusProgression = getStatusProgression();

  // Get persona distribution
  const getPersonaDistribution = () => {
    const distribution = agentSessions.reduce((acc, session) => {
      const persona = session.personaType.replace(/_/g, ' ');
      acc[persona] = (acc[persona] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .map(([persona, count]) => ({ persona, count }))
      .sort((a, b) => b.count - a.count);
  };

  const personaDistribution = getPersonaDistribution();

  return (
    <div className="space-y-6">
      {/* Status Progression */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Status Progression</h4>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-500"
              style={{ width: `${statusProgression.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {statusProgression.currentIndex + 1}/{statusProgression.totalStages}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          {['Backlog', 'In Progress', 'Review', 'QA', 'Acceptance', 'Done'].map((label, i) => (
            <span
              key={label}
              className={`text-center ${
                i <= statusProgression.currentIndex ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:bg-gray-800 hover:shadow-sm hover:shadow-gray-900/10 hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in duration-300 cursor-default"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">{metric.icon}</span>
              {metric.change && (
                <span
                  className={`text-xs ${metric.positive ? 'text-green-400' : 'text-red-400'}`}
                >
                  {metric.change}
                </span>
              )}
            </div>
            <div className={`text-lg font-bold text-white mb-0.5 ${metric.color}`}>
              {metric.value}
            </div>
            <div className="text-xs text-gray-500">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Agent Activity Breakdown */}
      {agentSessions.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Agent Activity Breakdown</h4>
          <div className="space-y-2">
            {personaDistribution.map(({ persona, count }) => (
              <div key={persona} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-32 truncate capitalize">{persona}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${(count / agentSessions.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Summary */}
      {(notes.length > 0 || gates.length > 0) && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Activity Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{notes.length}</div>
              <div className="text-xs text-gray-500">Notes & Handoffs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{gates.length}</div>
              <div className="text-xs text-gray-500">Transition Gates</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
