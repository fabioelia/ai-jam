import { db } from '../db/connection.js';
import { ticketNotes, tickets } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentDelegationMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  delegatedSessions: number;
  directResolutions: number;
  delegationRate: number;
  avgHandoffDepth: number;
  maxHandoffDepth: number;
  delegationScore: number;
  delegationTier: 'balanced' | 'over-delegator' | 'under-delegator' | 'isolated';
}

export interface AgentDelegationDepthReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgDelegationRate: number;
    maxChainDepth: number;
    balancedAgents: number;
    overDelegators: string[];
  };
  agents: AgentDelegationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeDelegationScore(delegationRate: number, avgHandoffDepth: number): number {
  let score = 100;
  if (delegationRate > 80) score -= 30;
  else if (delegationRate > 60) score -= 15;
  else if (delegationRate < 10) score -= 25;
  if (avgHandoffDepth > 5) score -= 20;
  else if (avgHandoffDepth > 3) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getDelegationTier(delegationRate: number, score: number): AgentDelegationMetrics['delegationTier'] {
  if (score >= 70) return 'balanced';
  if (delegationRate > 60) return 'over-delegator';
  if (delegationRate < 10 && score < 70) return 'under-delegator';
  return 'isolated';
}

type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

export async function analyzeAgentDelegationDepth(projectId: string): Promise<AgentDelegationDepthReport> {
  const projectTickets = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.projectId, projectId));
  const ticketIds = projectTickets.map(t => t.id);

  if (ticketIds.length === 0) {
    return {
      projectId, generatedAt: new Date().toISOString(),
      summary: { totalAgents: 0, avgDelegationRate: 0, maxChainDepth: 0, balancedAgents: 0, overDelegators: [] },
      agents: [], insights: [], recommendations: []
    };
  }

  const notes: NoteRow[] = await db
    .select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      authorId: ticketNotes.authorId,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
    })
    .from(ticketNotes)
    .where(inArray(ticketNotes.ticketId, ticketIds));

  if (notes.length === 0) {
    return {
      projectId, generatedAt: new Date().toISOString(),
      summary: { totalAgents: 0, avgDelegationRate: 0, maxChainDepth: 0, balancedAgents: 0, overDelegators: [] },
      agents: [], insights: [], recommendations: []
    };
  }

  // Group notes by agentId (authorId)
  const agentMap = new Map<string, NoteRow[]>();
  for (const note of notes) {
    const agentId = note.authorId || 'unknown';
    if (!agentMap.has(agentId)) agentMap.set(agentId, []);
    agentMap.get(agentId)!.push(note);
  }

  // Build ticket→notes map for chain depth computation
  const ticketNotesMap = new Map<string, NoteRow[]>();
  for (const note of notes) {
    if (!ticketNotesMap.has(note.ticketId)) ticketNotesMap.set(note.ticketId, []);
    ticketNotesMap.get(note.ticketId)!.push(note);
  }

  const agentMetrics: AgentDelegationMetrics[] = [];
  for (const [agentId, agentNotes] of agentMap) {
    const totalSessions = agentNotes.length;
    // Delegated = notes where agent handed off to someone else (has handoffTo)
    const delegatedSessions = agentNotes.filter(n => n.handoffTo).length;
    const directResolutions = totalSessions - delegatedSessions;
    const delegationRate = totalSessions > 0 ? (delegatedSessions / totalSessions) * 100 : 0;

    // Compute avg/max chain depth for tickets this agent initiated (no handoffFrom)
    const initiatedTickets = new Set(agentNotes.filter(n => !n.handoffFrom).map(n => n.ticketId));
    let totalDepth = 0;
    let maxDepth = 0;
    for (const tid of initiatedTickets) {
      const chain = ticketNotesMap.get(tid) || [];
      const depth = chain.length;
      totalDepth += depth;
      if (depth > maxDepth) maxDepth = depth;
    }
    const avgHandoffDepth = initiatedTickets.size > 0 ? totalDepth / initiatedTickets.size : 0;
    const delegationScore = computeDelegationScore(delegationRate, avgHandoffDepth);
    const delegationTier = getDelegationTier(delegationRate, delegationScore);

    agentMetrics.push({
      agentId,
      agentName: agentId,
      totalSessions,
      delegatedSessions,
      directResolutions,
      delegationRate: Math.round(delegationRate * 10) / 10,
      avgHandoffDepth: Math.round(avgHandoffDepth * 10) / 10,
      maxHandoffDepth: maxDepth,
      delegationScore,
      delegationTier,
    });
  }

  const avgDelegationRate = agentMetrics.length > 0
    ? agentMetrics.reduce((s, a) => s + a.delegationRate, 0) / agentMetrics.length
    : 0;
  const maxChainDepth = agentMetrics.reduce((m, a) => Math.max(m, a.maxHandoffDepth), 0);
  const balancedAgents = agentMetrics.filter(a => a.delegationTier === 'balanced').length;
  const overDelegators = agentMetrics.filter(a => a.delegationTier === 'over-delegator').map(a => a.agentName);

  const insights: string[] = [];
  if (overDelegators.length > 0) insights.push(`${overDelegators.length} agent(s) are over-delegating (>60% delegation rate)`);
  if (maxChainDepth > 5) insights.push(`Maximum delegation chain depth of ${maxChainDepth} detected — consider flattening`);
  const underDelegators = agentMetrics.filter(a => a.delegationTier === 'under-delegator');
  if (underDelegators.length > 0) insights.push(`${underDelegators.length} agent(s) rarely delegate, possibly a bottleneck`);

  const recommendations: string[] = [];
  if (overDelegators.length > 0) recommendations.push('Review tasks delegated by over-delegators for unnecessary handoffs');
  if (underDelegators.length > 0) recommendations.push('Encourage under-delegators to share workload more evenly');

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agentMetrics.length,
      avgDelegationRate: Math.round(avgDelegationRate * 10) / 10,
      maxChainDepth,
      balancedAgents,
      overDelegators,
    },
    agents: agentMetrics,
    insights,
    recommendations,
  };
}
