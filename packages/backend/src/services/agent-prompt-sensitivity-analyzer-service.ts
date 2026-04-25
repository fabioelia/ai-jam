import Anthropic from '@anthropic-ai/sdk';

export interface AgentSensitivityMetric {
  agentId: string;
  agentName: string;
  totalResponses: number;
  highVarianceResponses: number;
  ambiguityFailures: number;
  robustResponses: number;
  sensitivityScore: number;
  robustnessScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  sensitivityLevel: 'robust' | 'moderate' | 'sensitive' | 'highly_sensitive';
}

export interface AgentPromptSensitivityReport {
  sensitivityScore: number;
  totalResponses: number;
  highVarianceRate: number;
  ambiguityFailureRate: number;
  robustnessScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  mostRobustAgent: string;
  mostSensitiveAgent: string;
  agents: AgentSensitivityMetric[];
  aiSummary: string;
  aiRecommendations: string[];
  analysisTimestamp: string;
}

export function computeSensitivityScore(
  totalResponses: number,
  highVarianceResponses: number,
): number {
  if (totalResponses === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((highVarianceResponses / totalResponses) * 100)));
}

export function computeRobustnessScore(sensitivityScore: number): number {
  return Math.max(0, 100 - sensitivityScore);
}

export function getSensitivityLevel(score: number): AgentSensitivityMetric['sensitivityLevel'] {
  if (score <= 10) return 'robust';
  if (score <= 30) return 'moderate';
  if (score <= 60) return 'sensitive';
  return 'highly_sensitive';
}

export async function analyzeAgentPromptSensitivity(): Promise<AgentPromptSensitivityReport> {
  const mockAgents = [
    { name: 'Backend Developer', totalResponses: 60, highVariance: 4, ambiguityFails: 2, robust: 54 },
    { name: 'Frontend Developer', totalResponses: 55, highVariance: 12, ambiguityFails: 5, robust: 38 },
    { name: 'QA Engineer', totalResponses: 48, highVariance: 6, ambiguityFails: 3, robust: 39 },
    { name: 'DevOps Engineer', totalResponses: 40, highVariance: 18, ambiguityFails: 8, robust: 14 },
    { name: 'Data Engineer', totalResponses: 35, highVariance: 2, ambiguityFails: 1, robust: 32 },
  ];

  const agents: AgentSensitivityMetric[] = mockAgents.map((a, i) => {
    const sensitivity = computeSensitivityScore(a.totalResponses, a.highVariance);
    const robustness = computeRobustnessScore(sensitivity);
    const trends: AgentSensitivityMetric['trend'][] = ['stable', 'improving', 'degrading'];
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      totalResponses: a.totalResponses,
      highVarianceResponses: a.highVariance,
      ambiguityFailures: a.ambiguityFails,
      robustResponses: a.robust,
      sensitivityScore: sensitivity,
      robustnessScore: robustness,
      trend: trends[i % 3],
      sensitivityLevel: getSensitivityLevel(sensitivity),
    };
  });

  const totalResponses = agents.reduce((s, a) => s + a.totalResponses, 0);
  const totalHighVariance = agents.reduce((s, a) => s + a.highVarianceResponses, 0);
  const totalAmbiguityFails = agents.reduce((s, a) => s + a.ambiguityFailures, 0);

  const overallSensitivity = computeSensitivityScore(totalResponses, totalHighVariance);
  const overallRobustness = computeRobustnessScore(overallSensitivity);
  const highVarianceRate = totalResponses > 0 ? Math.round((totalHighVariance / totalResponses) * 100) : 0;
  const ambiguityFailureRate = totalResponses > 0 ? Math.round((totalAmbiguityFails / totalResponses) * 100) : 0;

  const sorted = [...agents].sort((a, b) => a.sensitivityScore - b.sensitivityScore);
  const mostRobustAgent = sorted[0]?.agentName ?? 'N/A';
  const mostSensitiveAgent = sorted[sorted.length - 1]?.agentName ?? 'N/A';

  let aiSummary = 'Prompt sensitivity analysis complete.';
  let aiRecommendations: string[] = [
    'Add prompt normalization layer to reduce output variance from minor rephrasing.',
    'Train agents with adversarial prompt variations to improve ambiguity tolerance.',
    'Implement response consistency checks across semantically equivalent prompts.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze prompt sensitivity: ${agents.length} agents, overall sensitivity ${overallSensitivity}%, robustness score ${overallRobustness}, high-variance rate ${highVarianceRate}%, ambiguity failure rate ${ambiguityFailureRate}%. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI prompt sensitivity analysis failed, using fallback:', e);
  }

  return {
    sensitivityScore: overallSensitivity,
    totalResponses,
    highVarianceRate,
    ambiguityFailureRate,
    robustnessScore: overallRobustness,
    trend: 'stable',
    mostRobustAgent,
    mostSensitiveAgent,
    agents,
    aiSummary,
    aiRecommendations,
    analysisTimestamp: new Date().toISOString(),
  };
}
