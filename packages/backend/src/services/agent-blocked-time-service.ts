import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentBlockedTimeMetrics {
  agentId: string;
  agentName: string;
  totalActiveTasks: number;
  totalBlockedTasks: number;
  blockedTimeRate: number;
  avgBlockDurationHours: number;
  longestBlockHours: number;
  topBlockerType: string;
  unblockedScore: number;
  unblockedTier: 'unblocked' | 'occasionally-blocked' | 'frequently-blocked' | 'perpetually-blocked';
}

export interface AgentBlockedTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgBlockedTimeRate: number;
    mostBlockedAgent: string;
    leastBlockedAgent: string;
    criticalBlockCount: number;
  };
  agents: AgentBlockedTimeMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeUnblockedScore(
  blockedTimeRate: number,
  avgBlockDurationHours: number,
  longestBlockHours: number,
): number {
  let score = 100;
  score -= blockedTimeRate * 0.5;
  score -= Math.min(30, (avgBlockDurationHours / 24) * 30);
  score -= Math.min(20, (longestBlockHours / 72) * 20);
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getUnblockedTier(score: number): AgentBlockedTimeMetrics['unblockedTier'] {
  if (score >= 75) return 'unblocked';
  if (score >= 50) return 'occasionally-blocked';
  if (score >= 25) return 'frequently-blocked';
  return 'perpetually-blocked';
}

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  blockedBy: string | null;
  createdAt: Date | null;
};

export async function analyzeAgentBlockedTime(projectId: string): Promise<AgentBlockedTimeReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      blockedBy: tickets.blockedBy,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allSessions: { id: string; ticketId: string | null; personaType: string; status: string; startedAt: Date | null; completedAt: Date | null }[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (projectTickets.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: { totalAgents: 0, avgBlockedTimeRate: 0, mostBlockedAgent: '', leastBlockedAgent: '', criticalBlockCount: 0 },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  // Find blocked tickets (status='blocked' or has blockedBy)
  const blockedTicketSet = new Set(
    projectTickets.filter(t => t.status === 'blocked' || (t.blockedBy && t.blockedBy !== '')).map(t => t.id)
  );

  // Estimate block duration: sessions where startedAt to completedAt was long (proxy)
  const blockDurationByTicket = new Map<string, number>();
  for (const t of projectTickets) {
    if (!blockedTicketSet.has(t.id)) continue;
    const sessionsForTicket = allSessions.filter(s => s.ticketId === t.id);
    if (sessionsForTicket.length === 0) {
      blockDurationByTicket.set(t.id, 24); // default 24h
      continue;
    }
    const earliest = Math.min(...sessionsForTicket.map(s => s.startedAt ? new Date(s.startedAt).getTime() : Date.now()));
    const latest = Math.max(...sessionsForTicket.map(s => s.completedAt ? new Date(s.completedAt).getTime() : Date.now()));
    const hours = (latest - earliest) / (1000 * 60 * 60);
    blockDurationByTicket.set(t.id, Math.max(0, hours));
  }

  // criticalBlockCount: tasks blocked > 48 hours
  const criticalBlockCount = [...blockDurationByTicket.values()].filter(h => h > 48).length;

  // Group tickets by agent
  const ticketsByAgent = new Map<string, TicketRow[]>();
  for (const t of projectTickets) {
    if (!t.assignedPersona) continue;
    const list = ticketsByAgent.get(t.assignedPersona) ?? [];
    list.push(t);
    ticketsByAgent.set(t.assignedPersona, list);
  }

  const agents: AgentBlockedTimeMetrics[] = [];

  for (const [personaType, agentTickets] of ticketsByAgent.entries()) {
    const totalActiveTasks = agentTickets.length;
    const blockedTasks = agentTickets.filter(t => blockedTicketSet.has(t.id)).length;
    const blockedTimeRate = totalActiveTasks > 0 ? (blockedTasks / totalActiveTasks) * 100 : 0;

    const blockDurations = agentTickets
      .filter(t => blockedTicketSet.has(t.id))
      .map(t => blockDurationByTicket.get(t.id) ?? 0);

    const avgBlockDurationHours = blockDurations.length > 0
      ? blockDurations.reduce((a, b) => a + b, 0) / blockDurations.length
      : 0;
    const longestBlockHours = blockDurations.length > 0 ? Math.max(...blockDurations) : 0;

    // topBlockerType heuristic
    const hasDependency = agentTickets.some(t => t.blockedBy && t.blockedBy !== '');
    const topBlockerType = hasDependency ? 'dependency' : blockedTasks > 0 ? 'external' : 'none';

    const unblockedScore = computeUnblockedScore(blockedTimeRate, avgBlockDurationHours, longestBlockHours);
    const unblockedTier = getUnblockedTier(unblockedScore);

    agents.push({
      agentId: personaType,
      agentName: personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' '),
      totalActiveTasks,
      totalBlockedTasks: blockedTasks,
      blockedTimeRate: Math.round(blockedTimeRate * 100) / 100,
      avgBlockDurationHours: Math.round(avgBlockDurationHours * 10) / 10,
      longestBlockHours: Math.round(longestBlockHours * 10) / 10,
      topBlockerType,
      unblockedScore,
      unblockedTier,
    });
  }

  agents.sort((a, b) => b.unblockedScore - a.unblockedScore);

  const avgBlockedTimeRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.blockedTimeRate, 0) / agents.length * 100) / 100
    : 0;
  const mostBlockedAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const leastBlockedAgent = agents.length > 0 ? agents[0].agentName : '';

  let insights: string[] = [];
  let recommendations: string[] = [];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.unblockedScore}, tier=${a.unblockedTier}, blockedRate=${a.blockedTimeRate}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Analyze agent blocked time:\n${agentSummary}\nProvide JSON: {"insights": ["..."], "recommendations": ["..."]}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (Array.isArray(parsed.insights)) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
    }
  } catch {
    insights = ['Blocked time analysis complete.'];
    recommendations = ['Address dependency blockers to reduce blocked time rates.'];
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: { totalAgents: agents.length, avgBlockedTimeRate, mostBlockedAgent, leastBlockedAgent, criticalBlockCount },
    agents,
    insights,
    recommendations,
  };
}
