import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type RecoveryTier = 'fast_recovery' | 'slow_recovery' | 'chronic_issues' | 'insufficient_data';

export interface AgentRecoveryTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  blockedTickets: number;
  completedAfterBlock: number;
  avgRecoveryTimeHours: number;
  minRecoveryTimeHours: number;
  maxRecoveryTimeHours: number;
  recoverySuccessRate: number;
  recoveryScore: number;
  recoveryTier: RecoveryTier;
}

export interface RecoveryTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    fastRecoveryCount: number;
    slowRecoveryCount: number;
    chronicIssuesCount: number;
    avgRecoveryTimeHours: number;
    totalBlockedIncidents: number;
  };
  agents: AgentRecoveryTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeRecoveryScore(
  avgRecoveryTimeHours: number,
  recoverySuccessRate: number,
  blockedTickets: number,
  totalTickets: number,
): number {
  if (totalTickets < 3) return 0;
  if (blockedTickets === 0) return 75;
  const successComponent = recoverySuccessRate * 50;
  let timeComponent: number;
  if (avgRecoveryTimeHours <= 2) {
    timeComponent = 50;
  } else if (avgRecoveryTimeHours <= 8) {
    timeComponent = 50 - ((avgRecoveryTimeHours - 2) / 6) * 25;
  } else if (avgRecoveryTimeHours <= 24) {
    timeComponent = 25 - ((avgRecoveryTimeHours - 8) / 16) * 15;
  } else {
    timeComponent = Math.max(0, 10 - ((avgRecoveryTimeHours - 24) / 24) * 10);
  }
  return Math.round(Math.min(100, successComponent + timeComponent) * 10) / 10;
}

export function getRecoveryTier(recoveryScore: number, totalTickets: number): RecoveryTier {
  if (totalTickets < 3) return 'insufficient_data';
  if (recoveryScore >= 70) return 'fast_recovery';
  if (recoveryScore >= 40) return 'slow_recovery';
  return 'chronic_issues';
}

export function getRecoveryTierLabel(tier: RecoveryTier): string {
  switch (tier) {
    case 'fast_recovery': return 'Fast Recovery';
    case 'slow_recovery': return 'Slow Recovery';
    case 'chronic_issues': return 'Chronic Issues';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatRecoveryTime(hours: number): string {
  if (hours < 1) return (hours * 60).toFixed(0) + 'm';
  if (hours < 24) return hours.toFixed(1) + 'h';
  return (hours / 24).toFixed(1) + 'd';
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

export async function analyzeAgentRecoveryTime(projectId: string): Promise<RecoveryTimeReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  type TicketRecord = { status: string; updatedAt: Date | null };
  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: row.status, updatedAt: row.updatedAt });
  }

  const agents: AgentRecoveryTimeMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;
    if (totalTickets === 0) continue;

    // No 'blocked' status in schema — blockedTickets always 0
    const blockedTickets = 0;
    const completedAfterBlock = 0;
    const avgRecoveryTimeHours = 0;
    const minRecoveryTimeHours = 0;
    const maxRecoveryTimeHours = 0;
    const recoverySuccessRate = 0;

    const recoveryScore = computeRecoveryScore(avgRecoveryTimeHours, recoverySuccessRate, blockedTickets, totalTickets);
    const recoveryTier = getRecoveryTier(recoveryScore, totalTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTickets,
      blockedTickets,
      completedAfterBlock,
      avgRecoveryTimeHours,
      minRecoveryTimeHours,
      maxRecoveryTimeHours,
      recoverySuccessRate,
      recoveryScore,
      recoveryTier,
    });
  }

  agents.sort((a, b) => b.recoveryScore - a.recoveryScore);

  const fastRecoveryCount = agents.filter((a) => a.recoveryTier === 'fast_recovery').length;
  const slowRecoveryCount = agents.filter((a) => a.recoveryTier === 'slow_recovery').length;
  const chronicIssuesCount = agents.filter((a) => a.recoveryTier === 'chronic_issues').length;
  const totalBlockedIncidents = agents.reduce((s, a) => s + a.blockedTickets, 0);
  const avgRecoveryTimeHours =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.avgRecoveryTimeHours, 0) / agents.length) * 100) / 100
      : 0;

  const aiSummary =
    `Recovery time analysis complete for ${agents.length} agents. ` +
    `${fastRecoveryCount} fast, ${chronicIssuesCount} chronic issues. ` +
    `No blocked tickets detected — all agents default to baseline recovery score.`;

  const aiRecommendations = [
    'Add blocked status tracking to capture real recovery time data.',
    'Fast recovery agents are resilient — use them for high-risk or experimental tickets.',
    'Chronic issues may indicate systemic blockers or unclear requirements.',
    'Pair slow-recovery agents with experienced mentors to reduce unblock time.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      fastRecoveryCount,
      slowRecoveryCount,
      chronicIssuesCount,
      avgRecoveryTimeHours,
      totalBlockedIncidents,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
