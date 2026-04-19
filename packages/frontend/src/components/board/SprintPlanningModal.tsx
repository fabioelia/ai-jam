import type { SprintPlan } from '../../api/mutations.js';

interface SprintPlanningModalProps {
  plan: SprintPlan;
  velocity: number;
  onClose: () => void;
}

export default function SprintPlanningModal({ plan, velocity, onClose }: SprintPlanningModalProps) {
  const capacityUtilization = plan.estimatedPoints / plan.capacityUtilization;
  const utilizationPct = Math.round(plan.capacityUtilization * 100);

  function confidenceColor(confidence: number) {
    if (confidence >= 0.8) return 'text-green-400 bg-green-400/20 border-green-500/50';
    if (confidence >= 0.5) return 'text-yellow-400 bg-yellow-400/20 border-yellow-500/50';
    return 'text-red-400 bg-red-400/20 border-red-500/50';
  }

  function priorityColor(priority: string) {
    switch (priority.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-400/20 border-red-500/50';
      case 'high': return 'text-orange-400 bg-orange-400/20 border-orange-500/50';
      case 'medium': return 'text-yellow-400 bg-yellow-400/20 border-yellow-500/50';
      default: return 'text-gray-400 bg-gray-400/20 border-gray-500/50';
    }
  }

  function formatMarkdown(plan: SprintPlan): string {
    let md = `## Sprint Plan\n\n`;
    md += `**Sprint Goal:** ${plan.sprintGoal}\n\n`;
    md += `**Capacity:** ${plan.estimatedPoints} / ${capacityUtilization} pts avg velocity (${utilizationPct}%)\n\n`;
    md += `### Recommended Tickets\n`;
    md += `| Title | Priority | Points | Reason |\n`;
    md += `|-------|----------|--------|--------|\n`;
    for (const t of plan.recommendedTickets) {
      md += `| ${t.title} | ${t.priority} | ${t.storyPoints} | ${t.reason} |\n`;
    }
    if (plan.risks.length > 0) {
      md += `\n### Risks\n`;
      for (const r of plan.risks) {
        md += `- ${r}\n`;
      }
    }
    return md;
  }

  function handleCopy() {
    navigator.clipboard.writeText(formatMarkdown(plan));
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            &#8989; AI Sprint Plan
          </h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm border ${confidenceColor(plan.confidence)}`}>
              {Math.round(plan.confidence * 100)}% confidence
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sprint Goal */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Sprint Goal</h3>
            <blockquote className="text-gray-300 italic border-l-4 border-blue-500 bg-blue-500/5 px-4 py-2 rounded-r">
              {plan.sprintGoal}
            </blockquote>
          </div>

          {/* Capacity Bar */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Capacity</h3>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  plan.capacityUtilization > 1 ? 'bg-red-500' : plan.capacityUtilization > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, plan.capacityUtilization * 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {plan.estimatedPoints} pts planned / {capacityUtilization} pts avg velocity ({utilizationPct}%)
            </p>
          </div>

          {/* Recommended Tickets */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recommended Tickets</h3>
            {plan.recommendedTickets.length > 0 ? (
              <div className="space-y-2">
                {plan.recommendedTickets.map((ticket, i) => (
                  <div key={ticket.id} className="bg-gray-800/50 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-500 font-mono">#{i + 1}</span>
                          <span className="text-sm text-white font-medium truncate">{ticket.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{ticket.reason}</p>
                      </div>
                      <span className="text-sm font-mono text-gray-300 bg-gray-700 px-2 py-1 rounded shrink-0">
                        {ticket.storyPoints} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">No tickets recommended for this sprint.</p>
            )}
          </div>

          {/* Risks */}
          {plan.risks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Risks</h3>
              <div className="space-y-2">
                {plan.risks.map((risk, i) => (
                  <div key={i} className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm text-yellow-300">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {plan.reasoning && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Reasoning</h3>
              <p className="text-sm text-gray-500">{plan.reasoning}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={handleCopy}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
