import Anthropic from '@anthropic-ai/sdk';

export interface AgentDeadlineMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalDeadlines: number;
  metOnTime: number;
  avgDelayHours: number;
  adherenceScore: number;
  adherenceTier: 'excellent' | 'good' | 'at-risk' | 'failing';
}

export interface AgentDeadlineAdherenceAnalyzerReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdherenceScore: number;
    excellentCount: number;
    criticalDelays: number;
  };
  agents: AgentDeadlineMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeAdherenceScore(metOnTime: number, total: number, avgDelayHours: number): number {
  if (total === 0) return 50;
  const onTimeRate = metOnTime / total;
  const base = Math.round(onTimeRate * 70);
  const delayPenalty = avgDelayHours < 1 ? 30 : avgDelayHours < 4 ? 20 : avgDelayHours < 12 ? 10 : 0;
  return Math.min(100, Math.max(0, base + delayPenalty));
}

export function getAdherenceTier(score: number): AgentDeadlineMetrics['adherenceTier'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'at-risk';
  return 'failing';
}

export async function analyzeAgentDeadlineAdherenceAnalyzer(
  projectId: string,
): Promise<AgentDeadlineAdherenceAnalyzerReport> {
  const mockAgents = [
    { name: 'Backend Developer', role: 'Backend Developer', totalDeadlines: 40, metOnTime: 36, avgDelayHours: 0.5 },
    { name: 'Frontend Developer', role: 'Frontend Developer', totalDeadlines: 35, metOnTime: 29, avgDelayHours: 2.1 },
    { name: 'QA Engineer', role: 'QA Engineer', totalDeadlines: 28, metOnTime: 21, avgDelayHours: 3.8 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalDeadlines: 22, metOnTime: 14, avgDelayHours: 8.5 },
    { name: 'Data Engineer', role: 'Data Engineer', totalDeadlines: 15, metOnTime: 7, avgDelayHours: 14.2 },
  ];

  const agents: AgentDeadlineMetrics[] = mockAgents.map((a, i) => {
    const score = computeAdherenceScore(a.metOnTime, a.totalDeadlines, a.avgDelayHours);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalDeadlines: a.totalDeadlines,
      metOnTime: a.metOnTime,
      avgDelayHours: a.avgDelayHours,
      adherenceScore: score,
      adherenceTier: getAdherenceTier(score),
    };
  });

  agents.sort((a, b) => b.adherenceScore - a.adherenceScore);

  const avgAdherenceScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.adherenceScore, 0) / agents.length)
      : 0;
  const excellentCount = agents.filter((a) => a.adherenceTier === 'excellent').length;
  const criticalDelays = agents.filter((a) => a.adherenceTier === 'failing').length;

  let aiSummary = 'Deadline adherence analysis complete.';
  let aiRecommendations: string[] = [
    'Investigate chronic deadline misses to identify systemic blockers.',
    'Set realistic time estimates for complex tasks.',
    'Implement deadline reminders for agents with at-risk adherence scores.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent deadline adherence: ${agents.length} agents, avg score ${avgAdherenceScore}, ${excellentCount} excellent, ${criticalDelays} failing. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI deadline adherence analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgAdherenceScore,
      excellentCount,
      criticalDelays,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
