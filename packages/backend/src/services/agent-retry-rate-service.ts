import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type EfficiencyTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

export interface AgentRetryRateMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTicketsAttempted: number;
  retriedTickets: number;
  totalSessions: number;
  retryRate: number;
  avgSessionsPerTicket: number;
  maxSessionsOnOneTicket: number;
  efficiencyScore: number;
  efficiencyTier: EfficiencyTier;
}

export interface RetryRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highRetryCount: number;
    efficientCount: number;
    avgRetryRate: number;
    totalRetriedTickets: number;
  };
  agents: AgentRetryRateMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeEfficiencyScore(retryRate: number, maxSessionsOnOneTicket: number): number {
  return Math.round(
    Math.min(100, Math.max(0, 100 - (retryRate * 50) - (Math.max(0, maxSessionsOnOneTicket - 1) * 8))) * 10,
  ) / 10;
}

export function getEfficiencyTier(efficiencyScore: number, totalSessions: number): EfficiencyTier {
  if (totalSessions < 2) return 'insufficient_data';
  if (efficiencyScore >= 75) return 'high';
  if (efficiencyScore >= 45) return 'moderate';
  return 'low';
}

export function getEfficiencyTierLabel(efficiencyTier: EfficiencyTier): string {
  switch (efficiencyTier) {
    case 'high': return 'Efficient';
    case 'moderate': return 'Moderate';
    case 'low': return 'High Retry';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatRetryRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Full Stack Developer';
}

export async function analyzeAgentRetryRate(projectId: string): Promise<RetryRateReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group by (personaType, ticketId)
  type TicketSessionMap = Map<string, number>;
  const agentMap = new Map<string, TicketSessionMap>();

  for (const s of sessions) {
    if (!s.ticketId) continue;
    const name = s.personaType;
    if (!agentMap.has(name)) agentMap.set(name, new Map());
    const ticketMap = agentMap.get(name)!;
    ticketMap.set(s.ticketId, (ticketMap.get(s.ticketId) ?? 0) + 1);
  }

  const agents: AgentRetryRateMetrics[] = [];

  for (const [name, ticketMap] of agentMap.entries()) {
    const totalTicketsAttempted = ticketMap.size;
    const retriedTickets = [...ticketMap.values()].filter((count) => count >= 2).length;
    const totalSessions = [...ticketMap.values()].reduce((s, c) => s + c, 0);
    const retryRate = totalTicketsAttempted > 0
      ? Math.round((retriedTickets / totalTicketsAttempted) * 1000) / 1000
      : 0;
    const avgSessionsPerTicket = totalTicketsAttempted > 0
      ? Math.round((totalSessions / totalTicketsAttempted) * 100) / 100
      : 0;
    const maxSessionsOnOneTicket = ticketMap.size > 0
      ? Math.max(...ticketMap.values())
      : 0;

    const efficiencyScore = totalSessions < 2
      ? 0
      : computeEfficiencyScore(retryRate, maxSessionsOnOneTicket);
    const efficiencyTier = getEfficiencyTier(efficiencyScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTicketsAttempted,
      retriedTickets,
      totalSessions,
      retryRate,
      avgSessionsPerTicket,
      maxSessionsOnOneTicket,
      efficiencyScore,
      efficiencyTier,
    });
  }

  agents.sort((a, b) => a.efficiencyScore - b.efficiencyScore);

  const highRetryCount = agents.filter((a) => a.efficiencyTier === 'low').length;
  const efficientCount = agents.filter((a) => a.efficiencyTier === 'high').length;
  const totalRetriedTickets = agents.reduce((s, a) => s + a.retriedTickets, 0);
  const avgRetryRate = agents.length > 0
    ? Math.round((agents.reduce((s, a) => s + a.retryRate, 0) / agents.length) * 1000) / 1000
    : 0;

  const aiSummary =
    `Retry rate analysis complete for ${agents.length} agents. ` +
    `${highRetryCount} agents have high retry rates, ${efficientCount} are efficient. ` +
    `Total retried tickets: ${totalRetriedTickets}, average retry rate: ${formatRetryRate(avgRetryRate)}.`;

  const aiRecommendations = [
    'Agents with high retry rates may lack sufficient context — improve handoff notes.',
    'Review tickets with the most sessions to identify recurring blockers.',
    'Consider simplifying task scope for agents that frequently restart on the same ticket.',
    'Pair high-retry agents with efficient ones to transfer knowledge.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highRetryCount,
      efficientCount,
      avgRetryRate,
      totalRetriedTickets,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
