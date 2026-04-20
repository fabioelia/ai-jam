import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentReassignmentMetrics {
  agentPersona: string;
  ticketsReceived: number;
  ticketsReassignedAway: number;
  ticketsReassignedIn: number;
  reassignmentAwayRate: number;   // 3 decimal places
  avgHeldDuration: number;        // hours, 1 decimal place
  stabilityScore: number;         // 100 - (reassignmentAwayRate * 100), clamped 0-100
  stabilityLevel: 'stable' | 'moderate' | 'volatile' | 'critical';
}

export interface ReassignmentHotspot {
  fromPersona: string;
  toPersona: string;
  count: number;
}

export interface AgentReassignmentReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentReassignmentMetrics[];
  hotspots: ReassignmentHotspot[];
  summary: {
    totalAgents: number;
    totalReassignments: number;
    avgReassignmentAwayRate: number;
    mostStableAgent: string | null;
    mostVolatileAgent: string | null;
  };
  aiSummary: string;
}

type NoteRow = {
  id: string;
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  projectId: string;
};

function getStabilityLevel(stabilityScore: number): AgentReassignmentMetrics['stabilityLevel'] {
  if (stabilityScore >= 80) return 'stable';
  if (stabilityScore >= 60) return 'moderate';
  if (stabilityScore >= 40) return 'volatile';
  return 'critical';
}

export function computeAgentMetrics(
  agentPersona: string,
  reassignmentNotes: NoteRow[],
  projectTickets: TicketRow[],
): AgentReassignmentMetrics {
  // ticketsReassignedAway: distinct ticket IDs where agent is handoffFrom
  const reassignedAwayTickets = new Set(
    reassignmentNotes.filter(n => n.handoffFrom === agentPersona).map(n => n.ticketId)
  );

  // ticketsReassignedIn: distinct ticket IDs where agent is handoffTo
  const reassignedInTickets = new Set(
    reassignmentNotes.filter(n => n.handoffTo === agentPersona).map(n => n.ticketId)
  );

  // ticketsReceived: distinct ticket IDs where agent is handoffTo OR is assignedPersona
  const receivedTickets = new Set<string>([
    ...reassignedInTickets,
    ...projectTickets.filter(t => t.assignedPersona === agentPersona).map(t => t.id),
  ]);

  const ticketsReceived = receivedTickets.size;
  const ticketsReassignedAway = reassignedAwayTickets.size;
  const ticketsReassignedIn = reassignedInTickets.size;

  const reassignmentAwayRate = ticketsReceived === 0
    ? 0
    : Math.round((ticketsReassignedAway / ticketsReceived) * 1000) / 1000;

  const stabilityScore = Math.round(Math.max(0, Math.min(100, 100 - (reassignmentAwayRate * 100))));
  const stabilityLevel = getStabilityLevel(stabilityScore);

  // avgHeldDuration: for each reassigned-away ticket, find duration between earliest note
  // where agent is handoffTo and the reassignment-away note
  let heldDurations: number[] = [];
  for (const ticketId of reassignedAwayTickets) {
    // Find the reassignment-away note (where handoffFrom = agent for this ticket)
    const awayNotes = reassignmentNotes
      .filter(n => n.handoffFrom === agentPersona && n.ticketId === ticketId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (awayNotes.length === 0) continue;

    // Find earliest note where agent is handoffTo for this ticket
    const inNotes = reassignmentNotes
      .filter(n => n.handoffTo === agentPersona && n.ticketId === ticketId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (inNotes.length === 0) continue;

    const arrivedAt = inNotes[0].createdAt.getTime();
    const leftAt = awayNotes[0].createdAt.getTime();
    const durationHours = (leftAt - arrivedAt) / (1000 * 60 * 60);
    if (durationHours >= 0) {
      heldDurations.push(durationHours);
    }
  }

  const avgHeldDuration = heldDurations.length > 0
    ? Math.round((heldDurations.reduce((s, v) => s + v, 0) / heldDurations.length) * 10) / 10
    : 0;

  return {
    agentPersona,
    ticketsReceived,
    ticketsReassignedAway,
    ticketsReassignedIn,
    reassignmentAwayRate,
    avgHeldDuration,
    stabilityScore,
    stabilityLevel,
  };
}

export async function analyzeAgentReassignmentRates(projectId: string): Promise<AgentReassignmentReport> {
  const [allNotes, allTickets] = await Promise.all([
    db.select({
      id: ticketNotes.id,
      ticketId: ticketNotes.ticketId,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
      createdAt: ticketNotes.createdAt,
    }).from(ticketNotes).where(isNotNull(ticketNotes.handoffFrom)),
    db.select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      projectId: tickets.projectId,
    }).from(tickets).where(eq(tickets.projectId, projectId)),
  ]);

  const projectTicketIds = new Set(allTickets.map(t => t.id));

  // Filter to reassignment notes: handoffFrom IS NOT NULL AND handoffTo IS NOT NULL AND handoffFrom != handoffTo
  const reassignmentNotes = allNotes.filter(
    n => projectTicketIds.has(n.ticketId) &&
      n.handoffFrom !== null &&
      n.handoffTo !== null &&
      n.handoffFrom !== n.handoffTo
  ) as (NoteRow & { handoffFrom: string; handoffTo: string })[];

  // Collect all agent personas
  const agentSet = new Set<string>();
  for (const n of reassignmentNotes) {
    agentSet.add(n.handoffFrom);
    agentSet.add(n.handoffTo);
  }
  for (const t of allTickets) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }

  const agents: AgentReassignmentMetrics[] = [];
  for (const agentPersona of agentSet) {
    agents.push(computeAgentMetrics(agentPersona, reassignmentNotes, allTickets));
  }

  // Sort by reassignmentAwayRate desc, then ticketsReceived desc
  agents.sort((a, b) => {
    if (b.reassignmentAwayRate !== a.reassignmentAwayRate) {
      return b.reassignmentAwayRate - a.reassignmentAwayRate;
    }
    return b.ticketsReceived - a.ticketsReceived;
  });

  // Hotspots: group by (handoffFrom, handoffTo), top 5 desc
  const hotspotMap = new Map<string, { fromPersona: string; toPersona: string; count: number }>();
  for (const n of reassignmentNotes) {
    const key = `${n.handoffFrom}|||${n.handoffTo}`;
    if (!hotspotMap.has(key)) {
      hotspotMap.set(key, { fromPersona: n.handoffFrom, toPersona: n.handoffTo, count: 0 });
    }
    hotspotMap.get(key)!.count++;
  }
  const hotspots: ReassignmentHotspot[] = [...hotspotMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Summary
  const totalReassignments = reassignmentNotes.length;
  const avgReassignmentAwayRate = agents.length === 0
    ? 0
    : agents.reduce((s, a) => s + a.reassignmentAwayRate, 0) / agents.length;

  const eligibleAgents = agents.filter(a => a.ticketsReceived >= 2);
  const mostStableAgent = eligibleAgents.length > 0
    ? eligibleAgents.reduce((best, a) => a.stabilityScore > best.stabilityScore ? a : best).agentPersona
    : null;
  const mostVolatileAgent = eligibleAgents.length > 0
    ? eligibleAgents.reduce((worst, a) => a.stabilityScore < worst.stabilityScore ? a : worst).agentPersona
    : null;

  // AI summary via OpenRouter
  let aiSummary = 'AI summary unavailable.';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://ai-jam.app',
        'X-Title': 'AI Jam',
      },
    });

    const stableCount = agents.filter(a => a.stabilityLevel === 'stable').length;
    const criticalCount = agents.filter(a => a.stabilityLevel === 'critical').length;
    const prompt = `Analyze this AI agent reassignment rate data for a software project:
- Total agents: ${agents.length}
- Total reassignments: ${totalReassignments}
- Average reassignment away rate: ${(avgReassignmentAwayRate * 100).toFixed(1)}%
- Stable agents: ${stableCount}, Critical agents: ${criticalCount}
- Most stable: ${mostStableAgent ?? 'N/A'}, Most volatile: ${mostVolatileAgent ?? 'N/A'}
- Top hotspots: ${hotspots.slice(0, 3).map(h => `${h.fromPersona}→${h.toPersona}(${h.count})`).join(', ') || 'none'}

Provide a concise 2-3 sentence summary of agent reassignment patterns, stability concerns, and recommendations.`;

    const response = await client.messages.create({
      model: 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      aiSummary = content.text;
    }
  } catch {
    aiSummary = 'AI summary unavailable.';
  }

  return {
    projectId,
    analyzedAt: new Date().toISOString(),
    agents,
    hotspots,
    summary: {
      totalAgents: agents.length,
      totalReassignments,
      avgReassignmentAwayRate: Math.round(avgReassignmentAwayRate * 1000) / 1000,
      mostStableAgent,
      mostVolatileAgent,
    },
    aiSummary,
  };
}
