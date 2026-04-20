export interface AgentGoalCompletionMetrics {
  agentId: string;
  agentName: string;
  totalGoals: number;
  fullyCompleted: number;
  partiallyCompleted: number;
  failed: number;
  completionRate: number;       // fullyCompleted / totalGoals * 100
  partialRate: number;          // partiallyCompleted / totalGoals * 100
  avgGoalsPerSession: number;
  completionScore: number;      // 0-100
  completionTier: 'exceptional' | 'solid' | 'partial' | 'struggling';
}

export interface AgentGoalCompletionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalGoals: number;
    overallCompletionRate: number;
    topPerformer: string;
    mostStruggling: string;
    exceptionalAgents: number;
  };
  agents: AgentGoalCompletionMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeCompletionScore(
  completionRate: number,
  failed: number,
  totalGoals: number,
): number {
  let score = completionRate;
  // Bonus for high completion rate
  if (completionRate >= 90) {
    score += 10;
  } else if (completionRate >= 75) {
    score += 5;
  }
  // Penalty for high failure rate
  if (totalGoals > 0 && failed / totalGoals > 0.3) {
    score -= 10;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeCompletionTier(completionScore: number): AgentGoalCompletionMetrics['completionTier'] {
  if (completionScore >= 85) return 'exceptional';
  if (completionScore >= 65) return 'solid';
  if (completionScore >= 40) return 'partial';
  return 'struggling';
}

export function analyzeAgentGoalCompletion(projectId: string, sessions: any[]): AgentGoalCompletionReport {
  const generatedAt = new Date().toISOString();

  if (!sessions || sessions.length === 0) {
    return {
      projectId,
      generatedAt,
      summary: {
        totalAgents: 0,
        totalGoals: 0,
        overallCompletionRate: 0,
        topPerformer: '',
        mostStruggling: '',
        exceptionalAgents: 0,
      },
      agents: [],
      insights: [],
      recommendations: [
        'No session data available. Start running agent sessions to gather goal completion metrics.',
        'Ensure agents are configured with clear goal definitions for better tracking.',
      ],
    };
  }

  // Group sessions by agent
  const agentMap = new Map<string, { name: string; sessions: any[] }>();
  for (const session of sessions) {
    const agentId = session.agentId || session.personaType || 'unknown';
    const agentName = session.agentName || agentId;
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, { name: agentName, sessions: [] });
    }
    agentMap.get(agentId)!.sessions.push(session);
  }

  const agents: AgentGoalCompletionMetrics[] = [];
  for (const [agentId, { name: agentName, sessions: agentSessions }] of agentMap.entries()) {
    const totalGoals = agentSessions.length;
    const fullyCompleted = agentSessions.filter((s) => s.status === 'completed').length;
    const failed = agentSessions.filter((s) => s.status === 'failed').length;
    const partiallyCompleted = totalGoals - fullyCompleted - failed;
    const completionRate = totalGoals > 0 ? Math.round((fullyCompleted / totalGoals) * 100) : 0;
    const partialRate = totalGoals > 0 ? Math.round((partiallyCompleted / totalGoals) * 100) : 0;
    const avgGoalsPerSession = totalGoals;
    const completionScore = computeCompletionScore(completionRate, failed, totalGoals);
    const completionTier = computeCompletionTier(completionScore);

    agents.push({
      agentId,
      agentName,
      totalGoals,
      fullyCompleted,
      partiallyCompleted,
      failed,
      completionRate,
      partialRate,
      avgGoalsPerSession,
      completionScore,
      completionTier,
    });
  }

  // Sort by completionScore descending
  agents.sort((a, b) => b.completionScore - a.completionScore);

  const totalGoals = agents.reduce((s, a) => s + a.totalGoals, 0);
  const totalFullyCompleted = agents.reduce((s, a) => s + a.fullyCompleted, 0);
  const overallCompletionRate = totalGoals > 0 ? Math.round((totalFullyCompleted / totalGoals) * 100) : 0;
  const topPerformer = agents.length > 0 ? agents[0].agentName : '';
  const mostStruggling = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const exceptionalAgents = agents.filter((a) => a.completionTier === 'exceptional').length;

  const insights: string[] = [];
  if (exceptionalAgents > 0) {
    insights.push(`${exceptionalAgents} agent(s) are performing exceptionally well with high goal completion rates.`);
  }
  const strugglingAgents = agents.filter((a) => a.completionTier === 'struggling');
  if (strugglingAgents.length > 0) {
    insights.push(`${strugglingAgents.length} agent(s) are struggling and may need additional support or task reassignment.`);
  }
  if (overallCompletionRate >= 75) {
    insights.push(`Overall project goal completion rate of ${overallCompletionRate}% indicates a healthy team performance.`);
  }

  const recommendations: string[] = [];
  if (mostStruggling && mostStruggling !== topPerformer) {
    recommendations.push(`Review workload and task assignments for ${mostStruggling} to identify blockers.`);
  }
  recommendations.push('Monitor partial completion rates to identify tasks that may need better scoping.');
  if (overallCompletionRate < 60) {
    recommendations.push('Consider breaking down large goals into smaller, more achievable tasks to improve completion rates.');
  }

  return {
    projectId,
    generatedAt,
    summary: {
      totalAgents: agents.length,
      totalGoals,
      overallCompletionRate,
      topPerformer,
      mostStruggling,
      exceptionalAgents,
    },
    agents,
    insights,
    recommendations,
  };
}
