import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentTaskComplexity {
  personaId: string;
  totalTickets: number;
  avgTransitionsPerTicket: number;
  avgHandoffChainDepth: number;
  reworkRate: number;
  epicLinkRate: number;
  complexityScore: number;
  complexityTier: 'very-high' | 'high' | 'medium' | 'low';
}

export interface TaskComplexityReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentTaskComplexity[];
  summary: {
    totalAgentsAnalyzed: number;
    avgComplexityScore: number;
    highestComplexityAgent: string | null;
    lowestComplexityAgent: string | null;
  };
}

function normTransitions(avg: number): number {
  return Math.min(100, Math.max(0, ((avg - 1) / 7) * 100));
}

function normHandoff(avg: number): number {
  return Math.min(100, Math.max(0, ((avg - 1) / 4) * 100));
}

function getTier(score: number): AgentTaskComplexity['complexityTier'] {
  if (score >= 75) return 'very-high';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export async function analyzeTaskComplexity(projectId: string): Promise<TaskComplexityReport> {
  const now = new Date();

  const allTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, epicId: tickets.epicId })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgentsAnalyzed: 0, avgComplexityScore: 0, highestComplexityAgent: null, lowestComplexityAgent: null },
    };
  }

  const ticketIds = allTickets.map((t) => t.id);

  const allNotes = await db
    .select({ ticketId: ticketNotes.ticketId, authorId: ticketNotes.authorId, handoffFrom: ticketNotes.handoffFrom, handoffTo: ticketNotes.handoffTo })
    .from(ticketNotes)
    .where(inArray(ticketNotes.ticketId, ticketIds));

  const notesByTicket = new Map<string, typeof allNotes>();
  for (const note of allNotes) {
    if (!notesByTicket.has(note.ticketId)) notesByTicket.set(note.ticketId, []);
    notesByTicket.get(note.ticketId)!.push(note);
  }

  const personaMap = new Map<string, typeof allTickets>();
  for (const t of allTickets) {
    const persona = t.assignedPersona ?? 'Unassigned';
    if (!personaMap.has(persona)) personaMap.set(persona, []);
    personaMap.get(persona)!.push(t);
  }

  const agents: AgentTaskComplexity[] = [];
  for (const [personaId, personaTickets] of personaMap.entries()) {
    const totalTickets = personaTickets.length;

    const noteCounts = personaTickets.map((t) => (notesByTicket.get(t.id) ?? []).length);
    const avgTransitionsPerTicket = noteCounts.reduce((s, c) => s + c, 0) / totalTickets;

    const handoffDepths = personaTickets.map((t) => {
      const notes = notesByTicket.get(t.id) ?? [];
      const handoffNotes = notes.filter((n) => n.handoffFrom != null || n.handoffTo != null);
      return new Set(handoffNotes.map((n) => n.authorId)).size;
    });
    const avgHandoffChainDepth = handoffDepths.reduce((s, d) => s + d, 0) / totalTickets;

    const reworkRate = noteCounts.filter((c) => c > 2).length / totalTickets;
    const epicLinkRate = personaTickets.filter((t) => t.epicId != null).length / totalTickets;

    const complexityScore = Math.round(
      0.35 * normTransitions(avgTransitionsPerTicket) +
      0.30 * (reworkRate * 100) +
      0.25 * normHandoff(avgHandoffChainDepth) +
      0.10 * (epicLinkRate * 100),
    );

    agents.push({
      personaId,
      totalTickets,
      avgTransitionsPerTicket: Math.round(avgTransitionsPerTicket * 100) / 100,
      avgHandoffChainDepth: Math.round(avgHandoffChainDepth * 100) / 100,
      reworkRate: Math.round(reworkRate * 100) / 100,
      epicLinkRate: Math.round(epicLinkRate * 100) / 100,
      complexityScore,
      complexityTier: getTier(complexityScore),
    });
  }

  agents.sort((a, b) => b.complexityScore - a.complexityScore);

  const totalAgentsAnalyzed = agents.length;
  const avgComplexityScore =
    totalAgentsAnalyzed > 0
      ? Math.round(agents.reduce((s, a) => s + a.complexityScore, 0) / totalAgentsAnalyzed)
      : 0;
  const highestComplexityAgent = agents.length > 0 ? agents[0].personaId : null;
  const lowestComplexityAgent = agents.length > 0 ? agents[agents.length - 1].personaId : null;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents,
    summary: { totalAgentsAnalyzed, avgComplexityScore, highestComplexityAgent, lowestComplexityAgent },
  };
}
