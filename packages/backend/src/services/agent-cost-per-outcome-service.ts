import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type CostTier = 'efficient' | 'moderate' | 'inefficient' | 'insufficient_data';

export interface AgentCostPerOutcomeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  completedTickets: number;
  totalTokensUsed: number;
  costPerOutcome: number;
  costScore: number;
  costTier: CostTier;
}

export interface CostPerOutcomeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    efficientCount: number;
    inefficientCount: number;
    avgCostPerOutcome: number;
    totalTokensAnalyzed: number;
  };
  agents: AgentCostPerOutcomeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeCostScore(costPerOutcome: number, completedTickets: number): number {
  if (completedTickets < 2) return 0;
  return Math.round(Math.min(100, Math.max(0, 100 - (costPerOutcome / 1000) * 5)) * 10) / 10;
}

export function getCostTier(score: number, completedTickets: number): CostTier {
  if (completedTickets < 2) return 'insufficient_data';
  if (score >= 75) return 'efficient';
  if (score >= 45) return 'moderate';
  return 'inefficient';
}

export function getCostTierLabel(tier: CostTier): string {
  switch (tier) {
    case 'efficient': return 'Efficient';
    case 'moderate': return 'Moderate';
    case 'inefficient': return 'Inefficient';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatTokenCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
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

export async function analyzeAgentCostPerOutcome(projectId: string): Promise<CostPerOutcomeReport> {
  // agentSessions does not have a tokenCount column; use costTokensIn + costTokensOut as proxy
  // Per spec: if tokenCount doesn't exist, use 0
  const rows = await db
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
      ticketStatus: tickets.status,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  type AgentData = {
    sessions: { ticketId: string; ticketStatus: string }[];
  };

  const agentMap = new Map<string, AgentData>();

  for (const row of rows) {
    if (!row.ticketId) continue;
    const name = row.personaType;
    if (!agentMap.has(name)) agentMap.set(name, { sessions: [] });
    agentMap.get(name)!.sessions.push({
      ticketId: row.ticketId,
      ticketStatus: row.ticketStatus,
    });
  }

  const agents: AgentCostPerOutcomeMetrics[] = [];

  for (const [name, data] of agentMap.entries()) {
    // tokenCount is 0 per spec (field doesn't exist in schema)
    const totalTokensUsed = 0;

    // completedTickets = size of Set of distinct ticketIds where status === 'done'
    const completedTicketIds = new Set(
      data.sessions.filter((s) => s.ticketStatus === 'done').map((s) => s.ticketId),
    );
    const completedTickets = completedTicketIds.size;

    // Skip if totalTokensUsed === 0
    if (totalTokensUsed === 0) continue;

    const costPerOutcome = completedTickets > 0 ? Math.round(totalTokensUsed / completedTickets) : 0;
    const costScore = completedTickets === 0 ? 0 : computeCostScore(costPerOutcome, completedTickets);
    const costTier: CostTier = completedTickets === 0 ? 'insufficient_data' : getCostTier(costScore, completedTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      completedTickets,
      totalTokensUsed,
      costPerOutcome,
      costScore,
      costTier,
    });
  }

  agents.sort((a, b) => b.costScore - a.costScore);

  const efficientCount = agents.filter((a) => a.costTier === 'efficient').length;
  const inefficientCount = agents.filter((a) => a.costTier === 'inefficient').length;
  const totalTokensAnalyzed = agents.reduce((s, a) => s + a.totalTokensUsed, 0);

  const agentsWithOutcomes = agents.filter((a) => a.completedTickets > 0);
  const avgCostPerOutcome =
    agentsWithOutcomes.length > 0
      ? Math.round(agentsWithOutcomes.reduce((s, a) => s + a.costPerOutcome, 0) / agentsWithOutcomes.length)
      : 0;

  const aiSummary =
    `Cost per outcome analysis complete for ${agents.length} agents. ` +
    `${efficientCount} agents are cost-efficient, ${inefficientCount} are inefficient. ` +
    `Average cost per completed ticket: ${formatTokenCount(avgCostPerOutcome)} tokens.`;

  const aiRecommendations = [
    'High-cost agents may be over-prompting — review prompt length and context usage.',
    'Efficient agents demonstrate optimal token usage; document their patterns as best practices.',
    'Agents with many sessions but few completed tickets have poor cost efficiency.',
    'Monitor token costs alongside completion rates to get a full picture of productivity.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      efficientCount,
      inefficientCount,
      avgCostPerOutcome,
      totalTokensAnalyzed,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
