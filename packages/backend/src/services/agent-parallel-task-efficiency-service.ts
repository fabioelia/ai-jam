import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentParallelTaskMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  parallelTasks: number;
  maxConcurrentTasks: number;
  avgConcurrentTasks: number;
  contextSwitches: number;
  parallelCompletionRate: number;
  avgParallelDuration: number;
  efficiencyScore: number;
  efficiencyTier: 'expert' | 'capable' | 'struggling' | 'overwhelmed';
}

export interface AgentParallelTaskReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTasks: number;
    totalParallelTasks: number;
    overallParallelRate: number;
    mostEfficientAgent: string | null;
    expertAgents: number;
  };
  agents: AgentParallelTaskMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Parallel task efficiency analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Review agents handling multiple concurrent tasks to ensure quality outcomes.',
  'Consider limiting parallel tasks for agents with low completion rates.',
];

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function computeEfficiencyScore(
  parallelCompletionRate: number,
  avgConcurrentTasks: number,
): number {
  let score = parallelCompletionRate;
  if (avgConcurrentTasks >= 3 && parallelCompletionRate >= 80) {
    score += 10;
  }
  if (parallelCompletionRate < 50) {
    score -= 15;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function efficiencyTier(score: number): AgentParallelTaskMetrics['efficiencyTier'] {
  if (score >= 85) return 'expert';
  if (score >= 65) return 'capable';
  if (score >= 40) return 'struggling';
  return 'overwhelmed';
}

export function buildAgentMetrics(sessions: SessionRow[]): AgentParallelTaskMetrics[] {
  // Group sessions by personaType
  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const metrics: AgentParallelTaskMetrics[] = [];

  for (const [personaType, agentSess] of sessionsByAgent.entries()) {
    const totalTasks = agentSess.length;

    // Sort sessions by startedAt for overlap detection
    const withTimes = agentSess
      .filter((s) => s.startedAt != null)
      .map((s) => ({
        ...s,
        startMs: new Date(s.startedAt!).getTime(),
        endMs: s.completedAt ? new Date(s.completedAt).getTime() : new Date(s.startedAt!).getTime() + 60000,
      }))
      .sort((a, b) => a.startMs - b.startMs);

    // Identify parallel sessions: sessions overlapping in time
    const parallelSessionIds = new Set<string>();
    let maxConcurrent = 0;
    const concurrentCounts: number[] = [];
    let contextSwitches = 0;

    for (let i = 0; i < withTimes.length; i++) {
      const s = withTimes[i];
      let concurrent = 1;
      for (let j = 0; j < withTimes.length; j++) {
        if (i === j) continue;
        const other = withTimes[j];
        // Check overlap: s.start < other.end && other.start < s.end
        if (s.startMs < other.endMs && other.startMs < s.endMs) {
          concurrent++;
          parallelSessionIds.add(s.id);
          parallelSessionIds.add(other.id);
        }
      }
      concurrentCounts.push(concurrent);
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
    }

    // Context switches: number of times agent switches between tasks (concurrent > 1 transitions)
    for (let i = 1; i < concurrentCounts.length; i++) {
      if (concurrentCounts[i] > 1 && concurrentCounts[i - 1] === 1) {
        contextSwitches++;
      }
    }

    const parallelTasks = parallelSessionIds.size;
    const avgConcurrentTasks =
      concurrentCounts.length > 0
        ? Math.round((concurrentCounts.reduce((s, c) => s + c, 0) / concurrentCounts.length) * 10) / 10
        : 0;

    // parallelCompletionRate: completed parallel tasks / total parallel tasks * 100
    let completedParallel = 0;
    for (const s of agentSess) {
      if (parallelSessionIds.has(s.id) && s.status === 'completed') {
        completedParallel++;
      }
    }
    const parallelCompletionRate =
      parallelTasks > 0 ? Math.round((completedParallel / parallelTasks) * 100) : 0;

    // avgParallelDuration in minutes
    const parallelDurations: number[] = [];
    for (const s of withTimes) {
      if (parallelSessionIds.has(s.id)) {
        const durationMs = s.endMs - s.startMs;
        parallelDurations.push(durationMs / 60000);
      }
    }
    const avgParallelDuration =
      parallelDurations.length > 0
        ? Math.round(parallelDurations.reduce((s, d) => s + d, 0) / parallelDurations.length)
        : 0;

    const score = computeEfficiencyScore(parallelCompletionRate, avgConcurrentTasks);
    const tier = efficiencyTier(score);

    metrics.push({
      agentId: personaType,
      agentName: personaType,
      totalTasks,
      parallelTasks,
      maxConcurrentTasks: maxConcurrent,
      avgConcurrentTasks,
      contextSwitches,
      parallelCompletionRate,
      avgParallelDuration,
      efficiencyScore: score,
      efficiencyTier: tier,
    });
  }

  metrics.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  return metrics;
}

export async function analyzeAgentParallelTaskEfficiency(
  projectId: string,
): Promise<AgentParallelTaskReport> {
  const now = new Date();

  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      generatedAt: now.toISOString(),
      summary: {
        totalAgents: 0,
        totalTasks: 0,
        totalParallelTasks: 0,
        overallParallelRate: 0,
        mostEfficientAgent: null,
        expertAgents: 0,
      },
      agents: [],
      insights: [],
      recommendations: FALLBACK_RECOMMENDATIONS,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const agents = buildAgentMetrics(allSessions);

  const totalTasks = allSessions.length;
  const totalParallelTasks = agents.reduce((s, a) => s + a.parallelTasks, 0);
  const overallParallelRate =
    totalTasks > 0 ? Math.round((totalParallelTasks / totalTasks) * 100) : 0;
  const expertAgents = agents.filter((a) => a.efficiencyTier === 'expert').length;
  const mostEfficientAgent = agents.length > 0 ? agents[0].agentId : null;

  const insights: string[] = [];
  if (expertAgents > 0) {
    insights.push(`${expertAgents} agent(s) achieved expert-tier parallel task efficiency.`);
  }
  const overwhelmedAgents = agents.filter((a) => a.efficiencyTier === 'overwhelmed');
  if (overwhelmedAgents.length > 0) {
    insights.push(
      `${overwhelmedAgents.length} agent(s) are overwhelmed by parallel tasks: ${overwhelmedAgents.map((a) => a.agentName).join(', ')}.`,
    );
  }
  const highContext = agents.filter((a) => a.contextSwitches > 3);
  if (highContext.length > 0) {
    insights.push(
      `${highContext.length} agent(s) have high context-switch counts, indicating frequent task juggling.`,
    );
  }

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentSummary = agents
      .slice(0, 8)
      .map(
        (a) =>
          `${a.agentName}: score=${a.efficiencyScore}, tier=${a.efficiencyTier}, parallelTasks=${a.parallelTasks}, parallelCompletionRate=${a.parallelCompletionRate}%, maxConcurrent=${a.maxConcurrentTasks}, contextSwitches=${a.contextSwitches}`,
      )
      .join('\n');

    const prompt = `Analyze this agent parallel task efficiency data:\n${agentSummary}\n\nOverall: totalParallelTasks=${totalParallelTasks}, overallParallelRate=${overallParallelRate}%\n\nReturn JSON with:\n- summary: one paragraph describing overall parallel task efficiency\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
        const parsed = JSON.parse(jsonStr);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Parallel task efficiency AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: now.toISOString(),
    summary: {
      totalAgents: agents.length,
      totalTasks,
      totalParallelTasks,
      overallParallelRate,
      mostEfficientAgent,
      expertAgents,
    },
    agents,
    insights,
    recommendations: aiRecommendations,
    aiSummary,
    aiRecommendations,
  };
}
