import { db } from '../db/connection.js';
import { tickets, ticketNotes, transitionGates, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentOutputQualityScore {
  personaId: string;
  handoffAcceptanceRate: number;
  ticketCompletionRate: number;
  reworkRate: number;
  sessionSuccessRate: number;
  overallQualityScore: number;
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor';
}

function qualityTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export async function scoreAgentOutputQuality(projectId: string): Promise<AgentOutputQualityScore[]> {
  const allTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) return [];

  const ticketIds = allTickets.map((t) => t.id);
  const ticketStatusMap = new Map(allTickets.map((t) => [t.id, t.status]));

  const [allNotes, allGates, allSessions] = await Promise.all([
    db
      .select({ handoffFrom: ticketNotes.handoffFrom, handoffTo: ticketNotes.handoffTo, ticketId: ticketNotes.ticketId })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds)),
    db
      .select({ ticketId: transitionGates.ticketId, result: transitionGates.result })
      .from(transitionGates)
      .where(inArray(transitionGates.ticketId, ticketIds)),
    db
      .select({ personaType: agentSessions.personaType, status: agentSessions.status, ticketId: agentSessions.ticketId })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds)),
  ]);

  // Group tickets by persona
  const personaMap = new Map<string, { assigned: string[]; done: string[] }>();
  for (const t of allTickets) {
    const p = t.assignedPersona ?? 'Unassigned';
    if (!personaMap.has(p)) personaMap.set(p, { assigned: [], done: [] });
    const entry = personaMap.get(p)!;
    entry.assigned.push(t.id);
    if (t.status === 'done') entry.done.push(t.id);
  }

  // Build rejected ticket set for rework
  const rejectedTicketIds = new Set(allGates.filter((g) => g.result === 'rejected').map((g) => g.ticketId));

  const results: AgentOutputQualityScore[] = [];

  for (const [persona, { assigned, done }] of personaMap.entries()) {
    if (assigned.length === 0) continue;

    // Ticket completion rate
    const ticketCompletionRate = Math.round((done.length / assigned.length) * 100);

    // Handoff acceptance rate: outgoing handoffs accepted by downstream
    const outgoing = allNotes.filter((n) => n.handoffFrom === persona);
    const accepted = outgoing.filter((n) => {
      const status = ticketStatusMap.get(n.ticketId);
      return status != null && ['qa', 'acceptance', 'done'].includes(status);
    });
    const handoffAcceptanceRate = outgoing.length === 0
      ? 100
      : Math.round((accepted.length / outgoing.length) * 100);

    // Rework rate: assigned tickets with a rejected gate / total done
    const assignedSet = new Set(assigned);
    const reworkedTickets = done.filter((id) => rejectedTicketIds.has(id) && assignedSet.has(id)).length;
    const reworkRate = done.length === 0 ? 0 : Math.round((reworkedTickets / done.length) * 100);

    // Session success rate
    const personaSessions = allSessions.filter((s) => s.personaType === persona && s.ticketId != null && assignedSet.has(s.ticketId!));
    const completedSessions = personaSessions.filter((s) => s.status === 'completed');
    const sessionSuccessRate = personaSessions.length === 0
      ? 100
      : Math.round((completedSessions.length / personaSessions.length) * 100);

    // Weighted overall score: completion 35%, acceptance 30%, rework-inverted 20%, session 15%
    const overallQualityScore = Math.round(
      ticketCompletionRate * 0.35 +
      handoffAcceptanceRate * 0.30 +
      (100 - reworkRate) * 0.20 +
      sessionSuccessRate * 0.15,
    );

    results.push({
      personaId: persona,
      handoffAcceptanceRate,
      ticketCompletionRate,
      reworkRate,
      sessionSuccessRate,
      overallQualityScore,
      qualityTier: qualityTier(overallQualityScore),
    });
  }

  results.sort((a, b) => b.overallQualityScore - a.overallQualityScore);
  return results;
}
