import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentResourceMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  totalTokensUsed: number;
  totalApiCalls: number;
  avgTokensPerTask: number;
  avgApiCallsPerTask: number;
  avgSessionDurationMs: number;
  consumptionScore: number;
  consumptionTier: 'efficient' | 'normal' | 'heavy' | 'excessive';
}

export interface AgentResourceConsumptionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTokensUsed: number;
    avgTokensPerAgent: number;
    avgApiCallsPerTask: number;
    mostEfficient: string;
    mostExpensive: string;
  };
  agents: AgentResourceMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeConsumptionScore(
  avgTokensPerTask: number,
  avgApiCallsPerTask: number,
  avgSessionDurationMs: number,
): number {
  const rawScore =
    (avgTokensPerTask / 1000) * 40 +
    (avgApiCallsPerTask / 10) * 35 +
    (avgSessionDurationMs / 60000) * 25;
  return Math.max(0, Math.min(100, Math.round(100 - rawScore)));
}

export function getConsumptionTier(score: number): AgentResourceMetrics['consumptionTier'] {
  if (score >= 75) return 'efficient';
  if (score >= 50) return 'normal';
  if (score >= 25) return 'heavy';
  return 'excessive';
}

export async function analyzeAgentResourceConsumption(
  projectId: string,
): Promise<AgentResourceConsumptionReport> {
  const now = new Date().toISOString();

  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  if (ticketIds.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: {
        totalAgents: 0,
        totalTokensUsed: 0,
        avgTokensPerAgent: 0,
        avgApiCallsPerTask: 0,
        mostEfficient: '',
        mostExpensive: '',
      },
      agents: [],
      insights: ['No agent sessions found for this project.'],
      recommendations: [],
    };
  }

  const sessionRows = await db
    .select({
      personaType: agentSessions.personaType,
      costTokensIn: agentSessions.costTokensIn,
      costTokensOut: agentSessions.costTokensOut,
      retryCount: agentSessions.retryCount,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: {
        totalAgents: 0,
        totalTokensUsed: 0,
        avgTokensPerAgent: 0,
        avgApiCallsPerTask: 0,
        mostEfficient: '',
        mostExpensive: '',
      },
      agents: [],
      insights: ['No agent sessions found for this project.'],
      recommendations: [],
    };
  }

  const agentMap = new Map<
    string,
    { tasks: number; tokens: number; apiCalls: number; durationMs: number }
  >();

  for (const s of sessionRows) {
    const id = s.personaType;
    if (!agentMap.has(id)) agentMap.set(id, { tasks: 0, tokens: 0, apiCalls: 0, durationMs: 0 });
    const e = agentMap.get(id)!;
    e.tasks += 1;
    e.tokens += (s.costTokensIn ?? 0) + (s.costTokensOut ?? 0);
    // retryCount + 1 as proxy for API calls per session
    e.apiCalls += (s.retryCount ?? 0) + 1;
    const dur =
      s.completedAt && s.startedAt
        ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
        : 30000;
    e.durationMs += Math.max(0, dur);
  }

  const agents: AgentResourceMetrics[] = [];

  for (const [personaType, d] of agentMap.entries()) {
    const avgTokensPerTask = d.tasks > 0 ? Math.round(d.tokens / d.tasks) : 0;
    const avgApiCallsPerTask = d.tasks > 0 ? Math.round(d.apiCalls / d.tasks) : 0;
    const avgSessionDurationMs = d.tasks > 0 ? Math.round(d.durationMs / d.tasks) : 0;
    const consumptionScore = computeConsumptionScore(
      avgTokensPerTask,
      avgApiCallsPerTask,
      avgSessionDurationMs,
    );
    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalTasks: d.tasks,
      totalTokensUsed: d.tokens,
      totalApiCalls: d.apiCalls,
      avgTokensPerTask,
      avgApiCallsPerTask,
      avgSessionDurationMs,
      consumptionScore,
      consumptionTier: getConsumptionTier(consumptionScore),
    });
  }

  agents.sort((a, b) => b.consumptionScore - a.consumptionScore);

  const totalTokensUsed = agents.reduce((s, a) => s + a.totalTokensUsed, 0);
  const avgTokensPerAgent = agents.length > 0 ? Math.round(totalTokensUsed / agents.length) : 0;
  const totalApiCalls = agents.reduce((s, a) => s + a.totalApiCalls, 0);
  const totalTasks = agents.reduce((s, a) => s + a.totalTasks, 0);
  const avgApiCallsPerTask = totalTasks > 0 ? Math.round(totalApiCalls / totalTasks) : 0;

  const insights: string[] = [
    `Total tokens used across all agents: ${totalTokensUsed.toLocaleString()}.`,
    `${agents.filter((a) => a.consumptionTier === 'efficient').length} agent(s) operating efficiently (score ≥ 75).`,
  ];

  const recommendations: string[] = [
    avgTokensPerAgent > 2000
      ? 'Consider reducing prompt verbosity to lower token usage per task.'
      : 'Token usage is within acceptable range — maintain current practices.',
  ];

  return {
    projectId,
    generatedAt: now,
    summary: {
      totalAgents: agents.length,
      totalTokensUsed,
      avgTokensPerAgent,
      avgApiCallsPerTask,
      mostEfficient: agents[0]?.agentName ?? '',
      mostExpensive: agents[agents.length - 1]?.agentName ?? '',
    },
    agents,
    insights,
    recommendations,
  };
}
