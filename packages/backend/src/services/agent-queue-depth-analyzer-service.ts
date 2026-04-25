import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export type QueueTier = 'overloaded' | 'busy' | 'normal' | 'idle';

export interface AgentQueueDepthMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  queuedTickets: number;
  inProgressTickets: number;
  totalActiveTickets: number;
  avgTicketAgeHours: number;
  oldestTicketAgeHours: number;
  queueScore: number;
  queueTier: QueueTier;
}

export interface QueueDepthReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    overloadedCount: number;
    idleCount: number;
    avgQueueDepth: number;
    totalQueuedTickets: number;
  };
  agents: AgentQueueDepthMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeQueueScore(totalActiveTickets: number, avgTicketAgeHours: number): number {
  return Math.round(
    Math.min(100, (totalActiveTickets * 10) + Math.min(50, avgTicketAgeHours / 24 * 5)) * 10,
  ) / 10;
}

export function getQueueTier(queueScore: number, totalActiveTickets: number): QueueTier {
  if (totalActiveTickets === 0) return 'idle';
  if (queueScore >= 70) return 'overloaded';
  if (queueScore >= 40) return 'busy';
  return 'normal';
}

export function getQueueTierLabel(queueTier: QueueTier): string {
  switch (queueTier) {
    case 'overloaded': return 'Overloaded';
    case 'busy': return 'Busy';
    case 'normal': return 'Normal';
    case 'idle': return 'Idle';
  }
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

export async function analyzeAgentQueueDepth(projectId: string): Promise<QueueDepthReport> {
  const projectTickets = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const activeStatuses = new Set(['backlog', 'in_progress']);
  const assignedTickets = projectTickets.filter(
    (t) => t.assignedPersona != null && activeStatuses.has(t.status),
  );

  const agentMap = new Map<string, { status: string; createdAt: Date }[]>();
  for (const t of assignedTickets) {
    const name = t.assignedPersona!;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: t.status, createdAt: t.createdAt });
  }

  const now = Date.now();
  const agents: AgentQueueDepthMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const queuedTickets = agentTickets.filter((t) => t.status === 'backlog').length;
    const inProgressTickets = agentTickets.filter((t) => t.status === 'in_progress').length;
    const totalActiveTickets = queuedTickets + inProgressTickets;

    const ageHours = agentTickets.map((t) => (now - t.createdAt.getTime()) / 3600000);
    const avgTicketAgeHours = totalActiveTickets > 0
      ? Math.round((ageHours.reduce((s, a) => s + a, 0) / ageHours.length) * 10) / 10
      : 0;
    const oldestTicketAgeHours = totalActiveTickets > 0
      ? Math.round(Math.max(...ageHours) * 10) / 10
      : 0;

    const queueScore = computeQueueScore(totalActiveTickets, avgTicketAgeHours);
    const queueTier = getQueueTier(queueScore, totalActiveTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      queuedTickets,
      inProgressTickets,
      totalActiveTickets,
      avgTicketAgeHours,
      oldestTicketAgeHours,
      queueScore,
      queueTier,
    });
  }

  agents.sort((a, b) => b.queueScore - a.queueScore);

  const overloadedCount = agents.filter((a) => a.queueTier === 'overloaded').length;
  const idleCount = agents.filter((a) => a.queueTier === 'idle').length;
  const totalQueuedTickets = agents.reduce((s, a) => s + a.queuedTickets, 0);
  const avgQueueDepth = agents.length > 0
    ? Math.round((agents.reduce((s, a) => s + a.totalActiveTickets, 0) / agents.length) * 10) / 10
    : 0;

  const aiSummary =
    `Queue depth analysis complete for ${agents.length} agents. ` +
    `${overloadedCount} agents are overloaded, ${idleCount} are idle. ` +
    `Total queued tickets: ${totalQueuedTickets}, average queue depth: ${avgQueueDepth}.`;

  const aiRecommendations = [
    'Rebalance assignments from overloaded agents to idle agents to improve throughput.',
    'Investigate oldest tickets in overloaded queues — they may be blocked or stale.',
    'Consider splitting large backlogs into smaller, focused work streams.',
    'Monitor busy agents closely to prevent them from becoming overloaded.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      overloadedCount,
      idleCount,
      avgQueueDepth,
      totalQueuedTickets,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
