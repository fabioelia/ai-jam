import Anthropic from '@anthropic-ai/sdk';

export interface AgentTokenCostMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  estimatedCostUsd: number;
  ticketsCompleted: number;
  costPerTicket: number;
  tokensPerTicket: number;
  efficiencyScore: number;
  efficiencyTier: 'optimal' | 'efficient' | 'moderate' | 'expensive';
}

export interface AgentTokenCostReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalEstimatedCost: number;
    avgEfficiencyScore: number;
  };
  agents: AgentTokenCostMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeEstimatedCost(tokensIn: number, tokensOut: number): number {
  const cost = tokensIn * 0.000003 + tokensOut * 0.000015;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function computeEfficiencyScore(
  tokensPerTicket: number,
  _costPerTicket: number,
  ticketsCompleted: number,
): number {
  if (ticketsCompleted === 0) return 0;
  const baseScore = Math.min(100, Math.max(0, 100 - tokensPerTicket / 500));
  const volumeBonus = ticketsCompleted >= 10 ? 10 : ticketsCompleted >= 5 ? 5 : 0;
  return Math.round(Math.min(100, Math.max(0, baseScore + volumeBonus)));
}

export function getEfficiencyTier(
  score: number,
): 'optimal' | 'efficient' | 'moderate' | 'expensive' {
  if (score >= 80) return 'optimal';
  if (score >= 60) return 'efficient';
  if (score >= 40) return 'moderate';
  return 'expensive';
}

export async function analyzeAgentTokenCostEfficiency(
  projectId: string,
): Promise<AgentTokenCostReport> {
  const mockAgents = [
    { name: 'Backend Developer', role: 'Backend Developer', totalSessions: 42, tokensIn: 45000, tokensOut: 12000, ticketsCompleted: 18 },
    { name: 'Frontend Developer', role: 'Frontend Developer', totalSessions: 38, tokensIn: 52000, tokensOut: 14000, ticketsCompleted: 15 },
    { name: 'QA Engineer', role: 'QA Engineer', totalSessions: 30, tokensIn: 38000, tokensOut: 9000, ticketsCompleted: 12 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalSessions: 22, tokensIn: 61000, tokensOut: 18000, ticketsCompleted: 8 },
    { name: 'Data Engineer', role: 'Data Engineer', totalSessions: 18, tokensIn: 75000, tokensOut: 22000, ticketsCompleted: 5 },
  ];

  const agents: AgentTokenCostMetrics[] = mockAgents.map((a, i) => {
    const totalTokens = a.tokensIn + a.tokensOut;
    const estimatedCostUsd = computeEstimatedCost(a.tokensIn, a.tokensOut);
    const tokensPerTicket = a.ticketsCompleted === 0 ? 0 : Math.round(totalTokens / a.ticketsCompleted);
    const costPerTicket =
      a.ticketsCompleted === 0
        ? 0
        : Math.round((estimatedCostUsd / a.ticketsCompleted) * 1_000_000) / 1_000_000;
    const efficiencyScore = computeEfficiencyScore(tokensPerTicket, costPerTicket, a.ticketsCompleted);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalSessions: a.totalSessions,
      totalTokensIn: a.tokensIn,
      totalTokensOut: a.tokensOut,
      totalTokens,
      estimatedCostUsd,
      ticketsCompleted: a.ticketsCompleted,
      costPerTicket,
      tokensPerTicket,
      efficiencyScore,
      efficiencyTier: getEfficiencyTier(efficiencyScore),
    };
  });

  agents.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const totalTokensIn = agents.reduce((s, a) => s + a.totalTokensIn, 0);
  const totalTokensOut = agents.reduce((s, a) => s + a.totalTokensOut, 0);
  const totalEstimatedCost =
    Math.round(agents.reduce((s, a) => s + a.estimatedCostUsd, 0) * 1_000_000) / 1_000_000;
  const avgEfficiencyScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.efficiencyScore, 0) / agents.length)
      : 0;

  let aiSummary = 'Token cost efficiency analysis complete.';
  let aiRecommendations: string[] = [
    'Optimize prompt length for agents with high tokens-per-ticket ratios.',
    'Review high-cost agents to identify unnecessary context repetition.',
    'Consider caching common context for frequently used agent roles.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent token cost efficiency: ${agents.length} agents, total estimated cost $${totalEstimatedCost.toFixed(6)}, avg efficiency score ${avgEfficiencyScore}. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI token cost efficiency analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      totalTokensIn,
      totalTokensOut,
      totalEstimatedCost,
      avgEfficiencyScore,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
