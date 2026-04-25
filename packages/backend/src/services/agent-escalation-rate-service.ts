import { db as defaultDb } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type DrizzleDb = typeof defaultDb;

export interface AgentEscalationRateMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  escalatedTickets: number;
  selfResolvedTickets: number;
  handoffCount: number;
  avgEscalationsPerTicket: number;
  escalationRate: number;
  escalationScore: number;
  escalationTier: string;
}

export interface EscalationRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highEscalationCount: number;
    lowEscalationCount: number;
    autonomousCount: number;
    avgEscalationRate: number;
    totalEscalations: number;
  };
  agents: AgentEscalationRateMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeEscalationScore(
  escalationRate: number,
  avgEscalationsPerTicket: number,
  totalTickets: number,
): number {
  if (totalTickets < 3) return 0;
  let score: number;
  if (escalationRate <= 0.1) {
    score = 90 - escalationRate * 100;
  } else if (escalationRate <= 0.3) {
    score = 80 - ((escalationRate - 0.1) / 0.2) * 30;
  } else if (escalationRate <= 0.6) {
    score = 50 - ((escalationRate - 0.3) / 0.3) * 30;
  } else {
    score = Math.max(0, 20 - ((escalationRate - 0.6) / 0.4) * 20);
  }
  return Math.round(score * 10) / 10;
}

export function getEscalationTier(escalationScore: number, totalTickets: number): string {
  if (totalTickets < 3) return 'insufficient_data';
  if (escalationScore >= 80) return 'autonomous';
  if (escalationScore >= 55) return 'low_escalation';
  if (escalationScore >= 30) return 'high_escalation';
  return 'chronic_escalator';
}

export function getEscalationTierLabel(tier: string): string {
  switch (tier) {
    case 'autonomous': return 'Autonomous';
    case 'low_escalation': return 'Low Escalation';
    case 'high_escalation': return 'High Escalation';
    case 'chronic_escalator': return 'Chronic Escalator';
    case 'insufficient_data': return 'Insufficient Data';
    default: return 'Insufficient Data';
  }
}

export function formatEscalationRate(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
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

export async function analyzeAgentEscalationRate(projectId: string, db: DrizzleDb = defaultDb): Promise<EscalationRateReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Build set of all personas
  const allPersonas = new Set<string>();
  for (const row of rows) {
    if (row.assignedPersona) allPersonas.add(row.assignedPersona);
  }

  type TicketRecord = { status: string };
  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: row.status });
  }

  const agents: AgentEscalationRateMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;
    if (totalTickets === 0) continue;

    const selfResolvedTickets = agentTickets.filter((t) => t.status === 'done').length;
    // Heuristic: escalatedTickets = tickets not done (still in progress/open/etc.)
    const escalatedTickets = agentTickets.filter((t) => t.status !== 'done').length;
    const handoffCount = escalatedTickets;

    const avgEscalationsPerTicket = Math.round((handoffCount / Math.max(totalTickets, 1)) * 10000) / 10000;
    const escalationRate = Math.round((escalatedTickets / Math.max(totalTickets, 1)) * 10000) / 10000;

    const escalationScore = computeEscalationScore(escalationRate, avgEscalationsPerTicket, totalTickets);
    const escalationTier = getEscalationTier(escalationScore, totalTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTickets,
      escalatedTickets,
      selfResolvedTickets,
      handoffCount,
      avgEscalationsPerTicket,
      escalationRate,
      escalationScore,
      escalationTier,
    });
  }

  agents.sort((a, b) => b.escalationScore - a.escalationScore);

  const autonomousCount = agents.filter((a) => a.escalationTier === 'autonomous').length;
  const lowEscalationCount = agents.filter((a) => a.escalationTier === 'low_escalation').length;
  const highEscalationCount = agents.filter((a) => a.escalationTier === 'high_escalation' || a.escalationTier === 'chronic_escalator').length;
  const totalEscalations = agents.reduce((s, a) => s + a.escalatedTickets, 0);
  const avgEscalationRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.escalationRate, 0) / agents.length) * 10000) / 10000
      : 0;

  const aiSummary =
    `Escalation rate analysis complete for ${agents.length} agents. ` +
    `${autonomousCount} autonomous, ${highEscalationCount} with high or chronic escalation. ` +
    `Average escalation rate across agents: ${formatEscalationRate(avgEscalationRate)}.`;

  const aiRecommendations = [
    'Autonomous agents handle tickets end-to-end — assign them complex, multi-step tasks.',
    'High escalation agents may need clearer task briefs or additional context at assignment.',
    'Review chronic escalators for role mismatch or recurring blocker patterns.',
    'Track escalation destinations to identify bottleneck agents receiving too many handoffs.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highEscalationCount,
      lowEscalationCount,
      autonomousCount,
      avgEscalationRate,
      totalEscalations,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
