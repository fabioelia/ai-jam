import Anthropic from '@anthropic-ai/sdk';

export interface AgentConsistencyMetric {
  agentId: string;
  agentName: string;
  totalSessions: number;
  sessionsWithContradictions: number;
  sessionsWithContextLoss: number;
  sessionsWithGoalDrift: number;
  consistencyScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  consistencyLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentMultiTurnConsistencyReport {
  consistencyScore: number;
  totalSessions: number;
  contradictionRate: number;
  contextLossRate: number;
  goalDriftRate: number;
  trend: 'improving' | 'stable' | 'degrading';
  mostConsistentAgent: string;
  leastConsistentAgent: string;
  agents: AgentConsistencyMetric[];
  aiSummary: string;
  aiRecommendations: string[];
  analysisTimestamp: string;
}

export function computeConsistencyScore(
  totalSessions: number,
  sessionsWithIssues: number,
): number {
  if (totalSessions === 0) return 100;
  const issueRate = sessionsWithIssues / totalSessions;
  return Math.min(100, Math.max(0, Math.round((1 - issueRate) * 100)));
}

export function getConsistencyLevel(score: number): AgentConsistencyMetric['consistencyLevel'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export async function analyzeAgentMultiTurnConsistency(): Promise<AgentMultiTurnConsistencyReport> {
  const mockAgents = [
    { name: 'Backend Developer', totalSessions: 48, contradictions: 3, contextLoss: 2, goalDrift: 1 },
    { name: 'Frontend Developer', totalSessions: 42, contradictions: 5, contextLoss: 4, goalDrift: 3 },
    { name: 'QA Engineer', totalSessions: 35, contradictions: 2, contextLoss: 1, goalDrift: 2 },
    { name: 'DevOps Engineer', totalSessions: 28, contradictions: 7, contextLoss: 6, goalDrift: 4 },
    { name: 'Data Engineer', totalSessions: 20, contradictions: 1, contextLoss: 1, goalDrift: 0 },
  ];

  const agents: AgentConsistencyMetric[] = mockAgents.map((a, i) => {
    const totalIssues = Math.max(a.contradictions, a.contextLoss, a.goalDrift);
    const score = computeConsistencyScore(a.totalSessions, totalIssues);
    const trends: AgentConsistencyMetric['trend'][] = ['improving', 'stable', 'degrading'];
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      totalSessions: a.totalSessions,
      sessionsWithContradictions: a.contradictions,
      sessionsWithContextLoss: a.contextLoss,
      sessionsWithGoalDrift: a.goalDrift,
      consistencyScore: score,
      trend: trends[i % 3],
      consistencyLevel: getConsistencyLevel(score),
    };
  });

  const totalSessions = agents.reduce((s, a) => s + a.totalSessions, 0);
  const totalContradictions = agents.reduce((s, a) => s + a.sessionsWithContradictions, 0);
  const totalContextLoss = agents.reduce((s, a) => s + a.sessionsWithContextLoss, 0);
  const totalGoalDrift = agents.reduce((s, a) => s + a.sessionsWithGoalDrift, 0);

  const overallScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.consistencyScore, 0) / agents.length)
      : 100;
  const contradictionRate = totalSessions > 0 ? Math.round((totalContradictions / totalSessions) * 100) : 0;
  const contextLossRate = totalSessions > 0 ? Math.round((totalContextLoss / totalSessions) * 100) : 0;
  const goalDriftRate = totalSessions > 0 ? Math.round((totalGoalDrift / totalSessions) * 100) : 0;

  const sorted = [...agents].sort((a, b) => b.consistencyScore - a.consistencyScore);
  const mostConsistentAgent = sorted[0]?.agentName ?? 'N/A';
  const leastConsistentAgent = sorted[sorted.length - 1]?.agentName ?? 'N/A';

  let aiSummary = 'Multi-turn consistency analysis complete.';
  let aiRecommendations: string[] = [
    'Improve context window management to reduce context loss across turns.',
    'Add contradiction detection checkpoints before finalizing multi-turn decisions.',
    'Implement goal anchoring at session start to reduce goal drift over long exchanges.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze multi-turn consistency: ${agents.length} agents, overall score ${overallScore}, contradiction rate ${contradictionRate}%, context loss rate ${contextLossRate}%, goal drift rate ${goalDriftRate}%. Provide a 2-sentence summary and 3 recommendations.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        const lines = text.split('\n').filter((l) => l.trim());
        aiSummary = lines[0] ?? aiSummary;
        aiRecommendations =
          lines.slice(1, 4).filter(Boolean).length > 0
            ? lines.slice(1, 4).filter(Boolean)
            : aiRecommendations;
      }
    }
  } catch (e) {
    console.warn('AI multi-turn consistency analysis failed, using fallback:', e);
  }

  return {
    consistencyScore: overallScore,
    totalSessions,
    contradictionRate,
    contextLossRate,
    goalDriftRate,
    trend: 'stable',
    mostConsistentAgent,
    leastConsistentAgent,
    agents,
    aiSummary,
    aiRecommendations,
    analysisTimestamp: new Date().toISOString(),
  };
}
