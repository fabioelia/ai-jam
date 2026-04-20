export interface AgentDecisionQualityMetrics {
  agentId: string;
  agentName: string;
  totalDecisions: number;
  correctDecisions: number;
  revisedDecisions: number;
  correctnessRate: number;
  revisionRate: number;
  impactScore: number;
  qualityScore: number;
  qualityTier: 'excellent' | 'good' | 'improving' | 'struggling';
}

export interface AgentDecisionQualityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalDecisions: number;
    topDecisionMaker: string | null;
    avgCorrectnessRate: number;
    highQualityAgents: number;
  };
  agents: AgentDecisionQualityMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeQualityScore(
  correctnessRate: number,
  revisionRate: number,
  impactScore: number,
): number {
  const raw = correctnessRate * 0.5 + (100 - revisionRate) * 0.3 + impactScore * 0.2;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

export function computeQualityTier(
  qualityScore: number,
): AgentDecisionQualityMetrics['qualityTier'] {
  if (qualityScore >= 80) return 'excellent';
  if (qualityScore >= 60) return 'good';
  if (qualityScore >= 40) return 'improving';
  return 'struggling';
}

export function analyzeAgentDecisionQuality(
  projectId: string,
  sessions: any[],
): AgentDecisionQualityReport {
  const generatedAt = new Date().toISOString();

  // Group sessions by personaType
  const agentMap = new Map<string, any[]>();
  for (const s of sessions) {
    const agentId: string = s.personaType ?? s.agentId ?? 'unknown';
    if (!agentMap.has(agentId)) agentMap.set(agentId, []);
    agentMap.get(agentId)!.push(s);
  }

  const agents: AgentDecisionQualityMetrics[] = [];

  for (const [agentId, agentSessions] of agentMap.entries()) {
    const totalDecisions = agentSessions.length;
    const correctDecisions = agentSessions.filter(
      (s) => s.status === 'completed' && (s.retryCount ?? 0) === 0,
    ).length;
    const revisedDecisions = agentSessions.filter((s) => (s.retryCount ?? 0) > 0).length;

    const correctnessRate =
      totalDecisions > 0 ? Math.round((correctDecisions / totalDecisions) * 100 * 100) / 100 : 0;
    const revisionRate =
      totalDecisions > 0 ? Math.round((revisedDecisions / totalDecisions) * 100 * 100) / 100 : 0;

    // Impact score: ratio of completed sessions, 0-100
    const completedSessions = agentSessions.filter((s) => s.status === 'completed').length;
    const impactScore =
      totalDecisions > 0
        ? Math.round((completedSessions / totalDecisions) * 100 * 100) / 100
        : 0;

    const qualityScore = computeQualityScore(correctnessRate, revisionRate, impactScore);
    const qualityTier = computeQualityTier(qualityScore);

    agents.push({
      agentId,
      agentName: agentId,
      totalDecisions,
      correctDecisions,
      revisedDecisions,
      correctnessRate,
      revisionRate,
      impactScore,
      qualityScore,
      qualityTier,
    });
  }

  agents.sort((a, b) => b.qualityScore - a.qualityScore);

  const totalDecisions = agents.reduce((s, a) => s + a.totalDecisions, 0);
  const topDecisionMaker = agents.length > 0 ? agents[0].agentId : null;
  const avgCorrectnessRate =
    agents.length > 0
      ? Math.round(
          (agents.reduce((s, a) => s + a.correctnessRate, 0) / agents.length) * 100,
        ) / 100
      : 0;
  const highQualityAgents = agents.filter(
    (a) => a.qualityTier === 'excellent' || a.qualityTier === 'good',
  ).length;

  const insights: string[] = [];
  const recommendations: string[] = [];

  if (agents.length === 0) {
    insights.push('No agent session data found for this project.');
    recommendations.push('Assign tickets to agents to begin tracking decision quality.');
  } else {
    const struggling = agents.filter((a) => a.qualityTier === 'struggling');
    if (struggling.length > 0) {
      insights.push(
        `${struggling.length} agent(s) are struggling with decision quality: ${struggling.map((a) => a.agentName).join(', ')}.`,
      );
      recommendations.push(
        'Review struggling agents and provide additional context or reduce task complexity.',
      );
    }
    const excellent = agents.filter((a) => a.qualityTier === 'excellent');
    if (excellent.length > 0) {
      insights.push(
        `${excellent.length} agent(s) show excellent decision quality: ${excellent.map((a) => a.agentName).join(', ')}.`,
      );
    }
    if (avgCorrectnessRate < 50) {
      recommendations.push(
        'Average correctness rate is below 50%. Consider reviewing task assignment strategy.',
      );
    }
  }

  return {
    projectId,
    generatedAt,
    summary: {
      totalAgents: agents.length,
      totalDecisions,
      topDecisionMaker,
      avgCorrectnessRate,
      highQualityAgents,
    },
    agents,
    insights,
    recommendations,
  };
}
