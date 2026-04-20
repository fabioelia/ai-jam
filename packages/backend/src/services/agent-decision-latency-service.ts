import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentDecisionLatencyMetrics {
  agentId: string;
  agentName: string;
  totalTasksAnalyzed: number;
  avgDecisionLatency: number;
  minLatency: number;
  maxLatency: number;
  latencyScore: number;
  latencyTier: 'swift' | 'prompt' | 'deliberate' | 'sluggish';
}

export interface AgentDecisionLatencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgDecisionLatency: number;
    fastestAgent: string | null;
    slowestAgent: string | null;
    swiftAgentCount: number;
  };
  agents: AgentDecisionLatencyMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeDecisionLatencyScore(
  avgDecisionLatency: number,
  maxObservedLatency: number,
): number {
  if (maxObservedLatency === 0) return 50;
  let score = 100 - (avgDecisionLatency / maxObservedLatency) * 80;
  if (avgDecisionLatency < 30000) score += 10;
  if (avgDecisionLatency > 300000) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getDecisionLatencyTier(score: number): AgentDecisionLatencyMetrics['latencyTier'] {
  if (score >= 80) return 'swift';
  if (score >= 60) return 'prompt';
  if (score >= 40) return 'deliberate';
  return 'sluggish';
}

export async function analyzeAgentDecisionLatency(
  projectId: string,
): Promise<AgentDecisionLatencyReport> {
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
      summary: { totalAgents: 0, avgDecisionLatency: 0, fastestAgent: null, slowestAgent: null, swiftAgentCount: 0 },
      agents: [],
      aiSummary: 'No ticket data available for decision latency analysis.',
      aiRecommendations: ['Collect agent session data to enable decision latency analysis.'],
    };
  }

  const sessionRows = await db
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: { totalAgents: 0, avgDecisionLatency: 0, fastestAgent: null, slowestAgent: null, swiftAgentCount: 0 },
      agents: [],
      aiSummary: 'No agent session data found.',
      aiRecommendations: ['Start running agent sessions to enable decision latency analysis.'],
    };
  }

  // Group by agent, collect latencies per ticket (earliest session per agent+ticket)
  const agentTicketMap = new Map<string, Map<string, number>>();
  for (const s of sessionRows) {
    if (!s.ticketId) continue;
    const latency =
      s.startedAt && s.completedAt
        ? Math.abs(new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime())
        : 60000;
    const ticketMap = agentTicketMap.get(s.personaType) ?? new Map<string, number>();
    const existing = ticketMap.get(s.ticketId);
    if (existing === undefined || latency < existing) {
      ticketMap.set(s.ticketId, latency);
    }
    agentTicketMap.set(s.personaType, ticketMap);
  }

  // Compute per-agent stats
  const allLatencies: number[] = [];
  const agentStats: Array<{ agentId: string; latencies: number[] }> = [];
  for (const [agentId, ticketMap] of agentTicketMap.entries()) {
    const latencies = Array.from(ticketMap.values());
    allLatencies.push(...latencies);
    agentStats.push({ agentId, latencies });
  }

  const maxObservedLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;

  const agents: AgentDecisionLatencyMetrics[] = agentStats.map(({ agentId, latencies }) => {
    const avg = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const latencyScore = computeDecisionLatencyScore(avg, maxObservedLatency);
    const latencyTier = getDecisionLatencyTier(latencyScore);
    return {
      agentId,
      agentName: agentId,
      totalTasksAnalyzed: latencies.length,
      avgDecisionLatency: avg,
      minLatency: min,
      maxLatency: max,
      latencyScore,
      latencyTier,
    };
  });

  agents.sort((a, b) => b.latencyScore - a.latencyScore);

  const avgDecisionLatency =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.avgDecisionLatency, 0) / agents.length)
      : 0;
  const fastestAgent = agents.length > 0 ? agents[0].agentName : null;
  const slowestAgent = agents.length > 0 ? agents[agents.length - 1].agentName : null;
  const swiftAgentCount = agents.filter((a) => a.latencyTier === 'swift').length;

  return {
    projectId,
    generatedAt: now,
    summary: { totalAgents: agents.length, avgDecisionLatency, fastestAgent, slowestAgent, swiftAgentCount },
    agents,
    aiSummary: `Analyzed ${agents.length} agent(s). Avg decision latency: ${Math.round(avgDecisionLatency / 1000)}s. ${swiftAgentCount} agent(s) classified as swift.`,
    aiRecommendations: [
      'Reduce decision latency by providing clearer task instructions.',
      'Review sluggish agents for blockers or context gaps.',
    ],
  };
}
