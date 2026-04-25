import Anthropic from '@anthropic-ai/sdk';

export interface AgentIdleTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalIdleTime: number;        // hours
  avgIdleGap: number;           // avg hours between task completions
  longestIdleStreak: number;    // longest consecutive idle hours
  responseLatency: number;      // avg hours from assignment to start
  idleScore: number;            // 0-100
  idleTier: 'highly-active' | 'active' | 'periodic' | 'dormant';
}

export interface AgentIdleTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProjectIdleGap: number;
    mostActive: string;         // agentName with lowest avgIdleGap
    highlyActiveCount: number;
  };
  agents: AgentIdleTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeIdleScore(
  avgIdleGap: number,
  longestIdleStreak: number,
  responseLatency: number,
): number {
  const base = Math.min(Math.max(0, 100 - avgIdleGap * 5), 70);
  const streakPenalty = Math.min(longestIdleStreak * 2, 20);
  const latencyBonus = responseLatency < 1 ? 10 : responseLatency < 4 ? 5 : 0;
  return Math.min(100, Math.max(0, Math.round(base - streakPenalty + latencyBonus)));
}

export function getIdleTier(score: number): AgentIdleTimeMetrics['idleTier'] {
  if (score >= 80) return 'highly-active';
  if (score >= 60) return 'active';
  if (score >= 40) return 'periodic';
  return 'dormant';
}

export async function analyzeAgentIdleTime(projectId: string): Promise<AgentIdleTimeReport> {
  // Mock data for 5 realistic agent entries
  const mockAgents = [
    { name: 'Frontend Developer', role: 'Frontend Developer', totalIdleTime: 12, avgIdleGap: 2.5, longestIdleStreak: 8, responseLatency: 0.5 },
    { name: 'Backend Developer', role: 'Backend Developer', totalIdleTime: 8, avgIdleGap: 1.8, longestIdleStreak: 5, responseLatency: 0.3 },
    { name: 'QA Engineer', role: 'QA Engineer', totalIdleTime: 20, avgIdleGap: 4.2, longestIdleStreak: 14, responseLatency: 1.2 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalIdleTime: 16, avgIdleGap: 3.5, longestIdleStreak: 12, responseLatency: 2.1 },
    { name: 'Data Engineer', role: 'Data Engineer', totalIdleTime: 28, avgIdleGap: 6.0, longestIdleStreak: 20, responseLatency: 3.5 },
  ];

  const agents: AgentIdleTimeMetrics[] = mockAgents.map((a, i) => {
    const score = computeIdleScore(a.avgIdleGap, a.longestIdleStreak, a.responseLatency);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalIdleTime: a.totalIdleTime,
      avgIdleGap: a.avgIdleGap,
      longestIdleStreak: a.longestIdleStreak,
      responseLatency: a.responseLatency,
      idleScore: score,
      idleTier: getIdleTier(score),
    };
  });

  agents.sort((a, b) => b.idleScore - a.idleScore);

  const highlyActiveCount = agents.filter((a) => a.idleTier === 'highly-active').length;
  const avgProjectIdleGap =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.avgIdleGap, 0) / agents.length) * 10) / 10
      : 0;

  const mostActive =
    agents.length > 0
      ? agents.reduce((best, a) => (a.avgIdleGap < best.avgIdleGap ? a : best)).agentName
      : 'N/A';

  let aiSummary = 'Agent idle time analysis complete.';
  let aiRecommendations: string[] = [
    'Assign queued backlog items to dormant agents to reduce idle gaps.',
    'Monitor response latency for agents with high assignment-to-start delays.',
    'Set SLA thresholds to alert when idle streaks exceed acceptable limits.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent idle time data: ${agents.length} agents, avg idle gap ${avgProjectIdleGap}h, ${highlyActiveCount} highly-active agents, most active: ${mostActive}. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI idle time analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgProjectIdleGap,
      mostActive,
      highlyActiveCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
