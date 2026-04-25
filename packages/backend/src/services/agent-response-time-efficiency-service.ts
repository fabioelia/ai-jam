import Anthropic from '@anthropic-ai/sdk';

export interface AgentResponseTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksReceived: number;
  avgResponseTime: number;
  fastResponseRate: number;
  queueDepth: number;
  timeToFirstAction: number;
  responseScore: number;
  responseTier: 'lightning' | 'responsive' | 'moderate' | 'sluggish';
}

export interface AgentResponseTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgResponseScore: number;
    fastestAgent: string;
    lightningCount: number;
  };
  agents: AgentResponseTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeResponseScore(
  fastResponseRate: number,
  avgResponseTime: number,
  queueDepth: number,
): number {
  const base = fastResponseRate * 60;
  const avgBonus =
    avgResponseTime < 0.5 ? 30 : avgResponseTime < 1 ? 20 : avgResponseTime < 2 ? 10 : 0;
  const queuePenalty = Math.min(queueDepth * 5, 20);
  return Math.min(100, Math.max(0, Math.round(base + avgBonus - queuePenalty)));
}

export function getResponseTier(score: number): AgentResponseTimeMetrics['responseTier'] {
  if (score >= 80) return 'lightning';
  if (score >= 60) return 'responsive';
  if (score >= 40) return 'moderate';
  return 'sluggish';
}

export async function analyzeAgentResponseTimeEfficiency(
  projectId: string,
): Promise<AgentResponseTimeReport> {
  // Mock data for 5 realistic agent entries
  const mockAgents = [
    { name: 'Frontend Developer', role: 'Frontend Developer', totalTasksReceived: 28, avgResponseTime: 0.4, fastResponseRate: 0.88, queueDepth: 2, timeToFirstAction: 0.3 },
    { name: 'Backend Developer', role: 'Backend Developer', totalTasksReceived: 35, avgResponseTime: 0.3, fastResponseRate: 0.92, queueDepth: 1, timeToFirstAction: 0.2 },
    { name: 'QA Engineer', role: 'QA Engineer', totalTasksReceived: 22, avgResponseTime: 1.2, fastResponseRate: 0.65, queueDepth: 4, timeToFirstAction: 0.9 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalTasksReceived: 15, avgResponseTime: 1.8, fastResponseRate: 0.55, queueDepth: 3, timeToFirstAction: 1.5 },
    { name: 'Data Engineer', role: 'Data Engineer', totalTasksReceived: 18, avgResponseTime: 2.5, fastResponseRate: 0.42, queueDepth: 5, timeToFirstAction: 2.1 },
  ];

  const agents: AgentResponseTimeMetrics[] = mockAgents.map((a, i) => {
    const score = computeResponseScore(a.fastResponseRate, a.avgResponseTime, a.queueDepth);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalTasksReceived: a.totalTasksReceived,
      avgResponseTime: a.avgResponseTime,
      fastResponseRate: a.fastResponseRate,
      queueDepth: a.queueDepth,
      timeToFirstAction: a.timeToFirstAction,
      responseScore: score,
      responseTier: getResponseTier(score),
    };
  });

  agents.sort((a, b) => b.responseScore - a.responseScore);

  const lightningCount = agents.filter((a) => a.responseTier === 'lightning').length;
  const avgResponseScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.responseScore, 0) / agents.length)
      : 0;
  const fastestAgent =
    agents.length > 0
      ? agents.reduce((best, a) => (a.avgResponseTime < best.avgResponseTime ? a : best)).agentName
      : 'N/A';

  let aiSummary = 'Response time efficiency analysis complete.';
  let aiRecommendations: string[] = [
    'Reduce queue depth for sluggish agents by redistributing incoming tasks.',
    'Set response time SLAs to ensure tasks are acknowledged within 30 minutes.',
    'Monitor fast response rates weekly and reward consistently lightning-tier agents.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent response time efficiency: ${agents.length} agents, avg score ${avgResponseScore}, ${lightningCount} lightning-tier agents, fastest: ${fastestAgent}. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI response time analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgResponseScore,
      fastestAgent,
      lightningCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
