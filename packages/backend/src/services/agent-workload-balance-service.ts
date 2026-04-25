import Anthropic from '@anthropic-ai/sdk';

export interface AgentWorkloadMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksAssigned: number;
  avgTasksPerSession: number;
  peakWorkloadSession: number;
  workloadVariance: number;
  utilizationRate: number;
  workloadScore: number;
  workloadTier: 'balanced' | 'overloaded' | 'underutilized' | 'idle';
}

export interface AgentWorkloadReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgWorkloadScore: number;
    mostLoaded: string;
    balancedCount: number;
  };
  agents: AgentWorkloadMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeWorkloadScore(
  utilizationRate: number,
  workloadVariance: number,
  avgTasksPerSession: number,
): number {
  const base = Math.min(utilizationRate * 60, 60);
  const varianceBonus =
    workloadVariance < 1 ? 30 : workloadVariance < 3 ? 20 : workloadVariance < 6 ? 10 : 0;
  const volumeBonus = avgTasksPerSession >= 5 ? 10 : avgTasksPerSession >= 2 ? 5 : 0;
  return Math.min(100, Math.max(0, Math.round(base + varianceBonus + volumeBonus)));
}

export function getWorkloadTier(score: number): AgentWorkloadMetrics['workloadTier'] {
  if (score >= 80) return 'balanced';
  if (score >= 60) return 'overloaded';
  if (score >= 40) return 'underutilized';
  return 'idle';
}

export async function analyzeAgentWorkloadBalance(
  projectId: string,
): Promise<AgentWorkloadReport> {
  // Mock data for 5 realistic agent entries
  const mockAgents = [
    { name: 'Backend Developer', role: 'Backend Developer', totalTasksAssigned: 42, avgTasksPerSession: 6, peakWorkloadSession: 12, workloadVariance: 0.8, utilizationRate: 0.92 },
    { name: 'Frontend Developer', role: 'Frontend Developer', totalTasksAssigned: 38, avgTasksPerSession: 5, peakWorkloadSession: 10, workloadVariance: 1.5, utilizationRate: 0.85 },
    { name: 'QA Engineer', role: 'QA Engineer', totalTasksAssigned: 25, avgTasksPerSession: 3, peakWorkloadSession: 7, workloadVariance: 2.8, utilizationRate: 0.65 },
    { name: 'DevOps Engineer', role: 'DevOps Engineer', totalTasksAssigned: 18, avgTasksPerSession: 2, peakWorkloadSession: 5, workloadVariance: 4.5, utilizationRate: 0.48 },
    { name: 'Data Engineer', role: 'Data Engineer', totalTasksAssigned: 8, avgTasksPerSession: 1, peakWorkloadSession: 3, workloadVariance: 7.2, utilizationRate: 0.22 },
  ];

  const agents: AgentWorkloadMetrics[] = mockAgents.map((a, i) => {
    const score = computeWorkloadScore(a.utilizationRate, a.workloadVariance, a.avgTasksPerSession);
    return {
      agentId: `agent-${i + 1}`,
      agentName: a.name,
      agentRole: a.role,
      totalTasksAssigned: a.totalTasksAssigned,
      avgTasksPerSession: a.avgTasksPerSession,
      peakWorkloadSession: a.peakWorkloadSession,
      workloadVariance: a.workloadVariance,
      utilizationRate: a.utilizationRate,
      workloadScore: score,
      workloadTier: getWorkloadTier(score),
    };
  });

  agents.sort((a, b) => b.workloadScore - a.workloadScore);

  const balancedCount = agents.filter((a) => a.workloadTier === 'balanced').length;
  const avgWorkloadScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.workloadScore, 0) / agents.length)
      : 0;
  const mostLoaded =
    agents.length > 0
      ? agents.reduce((best, a) => (a.utilizationRate > best.utilizationRate ? a : best)).agentName
      : 'N/A';

  let aiSummary = 'Workload balance analysis complete.';
  let aiRecommendations: string[] = [
    'Redistribute tasks from overloaded agents to underutilized ones to improve balance.',
    'Investigate high workload variance agents to identify task scheduling inefficiencies.',
    'Set workload caps per session to prevent agent burnout and ensure sustained performance.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent workload balance data: ${agents.length} agents, avg workload score ${avgWorkloadScore}, ${balancedCount} balanced agents, most loaded: ${mostLoaded}. Provide a 2-sentence summary and 3 recommendations.`;

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
    console.warn('AI workload balance analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgWorkloadScore,
      mostLoaded,
      balancedCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
