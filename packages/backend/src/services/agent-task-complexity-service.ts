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
  complexityTier: 'specialist' | 'capable' | 'generalist' | 'underutilized';
}

export interface AgentTaskComplexityReport {
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

export function computeTicketComplexity(
  title: string,
  description: string | null | undefined,
  priority: string,
): number {
  let score = 20; // base
  if (priority === 'critical') score += 30;
  else if (priority === 'high') score += 20;
  else if (priority === 'medium') score += 10;
  if (description && description.length > 500) score += 15;
  else if (description && description.length > 200) score += 8;
  if (title && title.length > 50) score += 5;
  return Math.max(0, Math.min(100, score));
}

export function getTier(score: number): AgentTaskComplexity['complexityTier'] {
  if (score >= 70) return 'specialist';
  if (score >= 50) return 'capable';
  if (score >= 30) return 'generalist';
  return 'underutilized';
}

export async function analyzeAgentTaskComplexity(projectId: string): Promise<AgentTaskComplexityReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      epicId: tickets.epicId,
      title: tickets.title,
      description: tickets.description,
      priority: tickets.priority,
    })
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

    const ticketScores = personaTickets.map((t) =>
      computeTicketComplexity(t.title, t.description, t.priority),
    );
    const complexityScore = Math.round(
      ticketScores.reduce((s, v) => s + v, 0) / totalTickets,
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
