import Anthropic from '@anthropic-ai/sdk';

export interface AgentErrorRecoveryMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalErrors: number;
  retrySuccessRate: number;
  avgRecoveryTime: number;
  failureCascadeDepth: number;
  firstAttemptSuccessRate: number;
  recoveryScore: number;
  recoveryTier: 'resilient' | 'recovering' | 'struggling' | 'critical';
}

export interface AgentErrorRecoveryRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgRecoveryScore: number;
    fastestRecoverer: string;
    resilientCount: number;
  };
  agents: AgentErrorRecoveryMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeRecoveryScore(
  retrySuccessRate: number,
  avgRecoveryTime: number,
  failureCascadeDepth: number,
): number {
  const base = retrySuccessRate * 60;
  const timeBonus =
    avgRecoveryTime < 1 ? 30 : avgRecoveryTime < 4 ? 20 : avgRecoveryTime < 8 ? 10 : 0;
  const cascadePenalty = Math.min(failureCascadeDepth * 5, 20);
  return Math.min(100, Math.max(0, Math.round(base + timeBonus - cascadePenalty)));
}

export function getRecoveryTier(score: number): AgentErrorRecoveryMetrics['recoveryTier'] {
  if (score >= 80) return 'resilient';
  if (score >= 60) return 'recovering';
  if (score >= 40) return 'struggling';
  return 'critical';
}

export async function analyzeAgentErrorRecoveryRate(
  projectId: string,
): Promise<AgentErrorRecoveryRateReport> {
  // Mock data for 5 realistic agent entries
  const mockAgents = [
    { name: 'Backend Developer', role: 'Backend Developer', totalErrors: 6, retrySuccessRate: 0.92, avgRecoveryTime: 0.5, failureCascadeDepth: 1, firstAttemptSuccessRate: 0.88 },
    { name: 'Frontend Developer', role: 'Frontend Developer', totalErrors: 8, retrySuccessRate: 0.85, avgRecoveryTime: 1.2, failureCascadeDepth: 2, firstAttemptSuccessRate: 0.80 },
    { name: 'QA Engineer', role: 'QA Engineer', totalErrors: 12, retrySuccessRate: 0.70, avgRecoveryTime: 3.5, failureCascadeDepth: 3, firstAttemptSuccessRate: 0.65 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalErrors: 10, retrySuccessRate: 0.62, avgRecoveryTime: 5.0, failureCascadeDepth: 4, firstAttemptSuccessRate: 0.55 },
    { name: 'Data Engineer', role: 'Data Engineer', totalErrors: 15, retrySuccessRate: 0.48, avgRecoveryTime: 9.0, failureCascadeDepth: 5, firstAttemptSuccessRate: 0.42 },
  ];

  const agents: AgentErrorRecoveryMetrics[] = mockAgents.map((a, i) => {
    const score = computeRecoveryScore(a.retrySuccessRate, a.avgRecoveryTime, a.failureCascadeDepth);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalErrors: a.totalErrors,
      retrySuccessRate: a.retrySuccessRate,
      avgRecoveryTime: a.avgRecoveryTime,
      failureCascadeDepth: a.failureCascadeDepth,
      firstAttemptSuccessRate: a.firstAttemptSuccessRate,
      recoveryScore: score,
      recoveryTier: getRecoveryTier(score),
    };
  });

  agents.sort((a, b) => b.recoveryScore - a.recoveryScore);

  const resilientCount = agents.filter((a) => a.recoveryTier === 'resilient').length;
  const avgRecoveryScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.recoveryScore, 0) / agents.length)
      : 0;
  const fastestRecoverer =
    agents.length > 0
      ? agents.reduce((best, a) => (a.avgRecoveryTime < best.avgRecoveryTime ? a : best)).agentName
      : 'N/A';

  let aiSummary = 'Error recovery rate analysis complete.';
  let aiRecommendations: string[] = [
    'Investigate cascading failures for agents with high failure cascade depths.',
    'Implement retry automation to improve first-attempt success rates.',
    'Set up early warning alerts when recovery times exceed acceptable thresholds.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent error recovery data: ${agents.length} agents, avg recovery score ${avgRecoveryScore}, ${resilientCount} resilient agents, fastest recoverer: ${fastestRecoverer}. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI error recovery analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgRecoveryScore,
      fastestRecoverer,
      resilientCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
