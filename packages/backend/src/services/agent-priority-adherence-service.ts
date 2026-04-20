export interface AgentPriorityAdherenceMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  highPriorityTasks: number;
  mediumPriorityTasks: number;
  lowPriorityTasks: number;
  priorityInversions: number;
  correctPrioritySequences: number;
  adherenceRate: number;
  avgEscalationResponseTime: number;
  adherenceScore: number;
  adherenceTier: 'disciplined' | 'consistent' | 'drifting' | 'chaotic';
}

export interface AgentPriorityAdherenceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTasks: number;
    overallAdherenceRate: number;
    mostDisciplined: string;
    mostChaotic: string;
    disciplinedAgents: number;
  };
  agents: AgentPriorityAdherenceMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeAdherenceScore(
  adherenceRate: number,
  priorityInversions: number,
  totalTasks: number,
): number {
  let score = adherenceRate;
  // Bonus
  if (adherenceRate >= 95) score += 10;
  else if (adherenceRate >= 80) score += 5;
  // Penalty: -15 if inversions > 20% of totalTasks
  if (totalTasks > 0 && priorityInversions / totalTasks > 0.2) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeAdherenceTier(adherenceScore: number): AgentPriorityAdherenceMetrics['adherenceTier'] {
  if (adherenceScore >= 85) return 'disciplined';
  if (adherenceScore >= 65) return 'consistent';
  if (adherenceScore >= 40) return 'drifting';
  return 'chaotic';
}

export function analyzeAgentPriorityAdherence(
  projectId: string,
  sessions: Array<{
    agentId: string;
    agentName?: string;
    totalTasks: number;
    highPriorityTasks: number;
    mediumPriorityTasks: number;
    lowPriorityTasks: number;
    priorityInversions: number;
    correctPrioritySequences: number;
    totalSequenceOpportunities: number;
    avgEscalationResponseTime?: number;
  }>,
): AgentPriorityAdherenceReport {
  const agents: AgentPriorityAdherenceMetrics[] = sessions.map((s) => {
    const adherenceRate = s.totalSequenceOpportunities > 0
      ? Math.round((s.correctPrioritySequences / s.totalSequenceOpportunities) * 100)
      : 100;
    const adherenceScore = computeAdherenceScore(adherenceRate, s.priorityInversions, s.totalTasks);
    return {
      agentId: s.agentId,
      agentName: s.agentName ?? s.agentId,
      totalTasks: s.totalTasks,
      highPriorityTasks: s.highPriorityTasks,
      mediumPriorityTasks: s.mediumPriorityTasks,
      lowPriorityTasks: s.lowPriorityTasks,
      priorityInversions: s.priorityInversions,
      correctPrioritySequences: s.correctPrioritySequences,
      adherenceRate,
      avgEscalationResponseTime: s.avgEscalationResponseTime ?? 0,
      adherenceScore,
      adherenceTier: computeAdherenceTier(adherenceScore),
    };
  });

  agents.sort((a, b) => b.adherenceScore - a.adherenceScore);

  const totalTasks = agents.reduce((s, a) => s + a.totalTasks, 0);
  const overallAdherenceRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.adherenceRate, 0) / agents.length)
    : 0;
  const mostDisciplined = agents.length > 0 ? agents[0].agentId : '';
  const mostChaotic = agents.length > 1 ? agents[agents.length - 1].agentId : mostDisciplined;
  const disciplinedAgents = agents.filter((a) => a.adherenceTier === 'disciplined').length;

  const insights: string[] = [
    `${disciplinedAgents} of ${agents.length} agents maintain disciplined priority adherence.`,
    `Overall system adherence rate: ${overallAdherenceRate}%.`,
  ];

  const recommendations: string[] = [
    'Review agents with chaotic priority adherence to improve task sequencing.',
    'Implement priority-aware task assignment to reduce inversions.',
    'Monitor escalation response times to ensure urgent tasks are handled promptly.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      totalTasks,
      overallAdherenceRate,
      mostDisciplined,
      mostChaotic,
      disciplinedAgents,
    },
    agents,
    insights,
    recommendations,
  };
}
