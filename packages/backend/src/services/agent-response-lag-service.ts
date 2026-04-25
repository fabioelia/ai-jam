import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type LagTier = 'fast' | 'moderate' | 'slow' | 'insufficient_data';

export interface AgentResponseLagMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTicketsAnalyzed: number;
  avgLagHours: number;
  medianLagHours: number;
  maxLagHours: number;
  minLagHours: number;
  slowTickets: number;
  lagScore: number;
  lagTier: LagTier;
}

export interface ResponseLagReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    slowCount: number;
    fastCount: number;
    avgLagHours: number;
    totalTicketsAnalyzed: number;
  };
  agents: AgentResponseLagMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeLagScore(
  avgLagHours: number,
  slowTickets: number,
  totalTicketsAnalyzed: number,
): number {
  if (totalTicketsAnalyzed < 2) return 0;
  const slowRatio = totalTicketsAnalyzed > 0 ? slowTickets / totalTicketsAnalyzed : 0;
  return Math.round(Math.min(100, Math.max(0, 100 - avgLagHours * 5 - slowRatio * 30)) * 10) / 10;
}

export function getLagTier(lagScore: number, totalTicketsAnalyzed: number): LagTier {
  if (totalTicketsAnalyzed < 2) return 'insufficient_data';
  if (lagScore >= 80) return 'fast';
  if (lagScore >= 50) return 'moderate';
  return 'slow';
}

export function getLagTierLabel(tier: LagTier): string {
  switch (tier) {
    case 'fast': return 'Fast Responder';
    case 'moderate': return 'Moderate';
    case 'slow': return 'Slow Responder';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatLagHours(hours: number): string {
  if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
  return `${hours.toFixed(1)}h`;
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

export async function analyzeAgentResponseLag(projectId: string): Promise<ResponseLagReport> {
  const rows = await db
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
      startedAt: agentSessions.startedAt,
      createdAt: tickets.createdAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // For each (personaType, ticketId) pair → take MIN startedAt as firstSession
  type PairKey = string;
  type PairData = { personaType: string; ticketId: string; minStartedAt: Date; createdAt: Date };
  const pairMap = new Map<PairKey, PairData>();

  for (const row of rows) {
    if (!row.ticketId || !row.startedAt || !row.createdAt) continue;
    const key = `${row.personaType}::${row.ticketId}`;
    const existing = pairMap.get(key);
    if (!existing || row.startedAt.getTime() < existing.minStartedAt.getTime()) {
      pairMap.set(key, {
        personaType: row.personaType,
        ticketId: row.ticketId,
        minStartedAt: row.startedAt,
        createdAt: row.createdAt,
      });
    }
  }

  // Group lags by agent
  const agentLags = new Map<string, number[]>();

  for (const pair of pairMap.values()) {
    const lagMs = pair.minStartedAt.getTime() - pair.createdAt.getTime();
    const lagHours = lagMs / 3600000;
    // Exclude negative lags
    if (lagHours < 0) continue;
    const roundedLag = Math.round(lagHours * 100) / 100;
    if (!agentLags.has(pair.personaType)) agentLags.set(pair.personaType, []);
    agentLags.get(pair.personaType)!.push(roundedLag);
  }

  const agents: AgentResponseLagMetrics[] = [];

  for (const [name, lags] of agentLags.entries()) {
    const totalTicketsAnalyzed = lags.length;
    if (totalTicketsAnalyzed === 0) continue;

    const slowTickets = lags.filter((l) => l > 4).length;
    const avgLagHours = Math.round((lags.reduce((s, l) => s + l, 0) / totalTicketsAnalyzed) * 100) / 100;

    const sorted = [...lags].sort((a, b) => a - b);
    let medianLagHours: number;
    if (sorted.length % 2 === 0) {
      const mid = sorted.length / 2;
      medianLagHours = Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
    } else {
      medianLagHours = Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100;
    }

    const maxLagHours = Math.round(Math.max(...lags) * 100) / 100;
    const minLagHours = Math.round(Math.min(...lags) * 100) / 100;

    const lagScore = computeLagScore(avgLagHours, slowTickets, totalTicketsAnalyzed);
    const lagTier = getLagTier(lagScore, totalTicketsAnalyzed);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTicketsAnalyzed,
      avgLagHours,
      medianLagHours,
      maxLagHours,
      minLagHours,
      slowTickets,
      lagScore,
      lagTier,
    });
  }

  agents.sort((a, b) => b.lagScore - a.lagScore);

  const slowCount = agents.filter((a) => a.lagTier === 'slow').length;
  const fastCount = agents.filter((a) => a.lagTier === 'fast').length;
  const totalTicketsAnalyzed = agents.reduce((s, a) => s + a.totalTicketsAnalyzed, 0);
  const avgLagHours =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.avgLagHours, 0) / agents.length) * 100) / 100
      : 0;

  const aiSummary =
    `Response lag analysis complete for ${agents.length} agents across ${totalTicketsAnalyzed} tickets. ` +
    `${fastCount} agents are fast responders, ${slowCount} are slow. ` +
    `Average lag: ${avgLagHours.toFixed(1)}h.`;

  const aiRecommendations = [
    'Slow responders may be overloaded — consider redistributing incoming tickets.',
    'High lag variance suggests inconsistent availability; review scheduling practices.',
    'Tickets waiting more than 4 hours for first response risk blocking downstream work.',
    'Pair fast responders with slower ones to ensure critical tickets are picked up promptly.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      slowCount,
      fastCount,
      avgLagHours,
      totalTicketsAnalyzed,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
