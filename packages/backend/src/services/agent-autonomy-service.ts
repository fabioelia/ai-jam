import { db } from '../db/connection.js';
import { agentSessions, tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';

export interface AgentAutonomyMetrics {
  personaId: string;
  autonomyScore: number;
  selfCompletionRate: number;
  redirectionRate: number;
  escalationCount: number;
  avgHandoffsPerTicket: number;
  autonomyLevel: 'high' | 'medium' | 'low' | 'dependent';
}

export type TicketRow = { id: string; assignedPersona: string | null; status: string };
export type NoteRow = {
  authorId: string;
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

function levelFromScore(score: number): AgentAutonomyMetrics['autonomyLevel'] {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'dependent';
}

export function computeAutonomyMetrics(
  personaId: string,
  projectTickets: TicketRow[],
  handoffNotes: NoteRow[],
): AgentAutonomyMetrics {
  const assignedTickets = projectTickets.filter(t => t.assignedPersona === personaId);
  const assignedIds = new Set(assignedTickets.map(t => t.id));

  const touchedViaHandoff = new Set(
    handoffNotes
      .filter(n => n.handoffFrom === personaId || n.handoffTo === personaId)
      .map(n => n.ticketId),
  );
  const totalTouched = new Set([...assignedIds, ...touchedViaHandoff]).size;

  const doneCount = assignedTickets.filter(t => t.status === 'done').length;
  const selfCompletionRate = totalTouched > 0 ? Math.round((doneCount / totalTouched) * 100) : 0;

  // Received handoffs = notes where handoffTo = personaId
  const receivedHandoffs = handoffNotes.filter(n => n.handoffTo === personaId);
  const totalReceived = receivedHandoffs.length;

  // Bounced = received handoff followed by outgoing handoff from same ticket within 24h
  let bouncedCount = 0;
  for (const received of receivedHandoffs) {
    const bounced = handoffNotes.some(
      n =>
        n.handoffFrom === personaId &&
        n.ticketId === received.ticketId &&
        n.createdAt > received.createdAt &&
        n.createdAt.getTime() - received.createdAt.getTime() <= 24 * 60 * 60 * 1000,
    );
    if (bounced) bouncedCount++;
  }
  const redirectionRate = totalReceived > 0 ? Math.round((bouncedCount / totalReceived) * 100) : 0;

  const escalationCount = handoffNotes.filter(
    n =>
      n.handoffFrom === personaId &&
      n.handoffTo !== null &&
      (n.handoffTo.toLowerCase().includes('supervisor') ||
        n.handoffTo.toLowerCase().includes('product')),
  ).length;

  const sentCount = handoffNotes.filter(n => n.handoffFrom === personaId).length;
  const avgHandoffsPerTicket =
    doneCount > 0 ? Math.round((sentCount / doneCount) * 10) / 10 : sentCount;

  const s1 = selfCompletionRate * 0.4;
  const s2 = (100 - redirectionRate) * 0.3;
  const s3 = Math.max(0, Math.min(100, 100 - escalationCount * 10)) * 0.2;
  const s4 = Math.max(0, Math.min(100, 100 - (avgHandoffsPerTicket - 1) * 20)) * 0.1;
  const autonomyScore = Math.round(s1 + s2 + s3 + s4);

  return {
    personaId,
    autonomyScore,
    selfCompletionRate,
    redirectionRate,
    escalationCount,
    avgHandoffsPerTicket,
    autonomyLevel: levelFromScore(autonomyScore),
  };
}

export async function analyzeAgentAutonomy(projectId: string): Promise<AgentAutonomyMetrics[]> {
  const [projectTickets, allNotes, allSessions] = await Promise.all([
    db
      .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, status: tickets.status })
      .from(tickets)
      .where(eq(tickets.projectId, projectId)),
    db
      .select({
        authorId: ticketNotes.authorId,
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(isNotNull(ticketNotes.handoffFrom)),
    db
      .select({ personaType: agentSessions.personaType, ticketId: agentSessions.ticketId })
      .from(agentSessions)
      .where(isNotNull(agentSessions.ticketId)),
  ]);

  const projectTicketIds = new Set(projectTickets.map(t => t.id));
  const projectNotes = allNotes.filter(n => projectTicketIds.has(n.ticketId));
  const projectSessions = allSessions.filter(s => s.ticketId && projectTicketIds.has(s.ticketId));

  const personaSet = new Set<string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) personaSet.add(t.assignedPersona);
  }
  for (const n of projectNotes) {
    if (n.handoffFrom) personaSet.add(n.handoffFrom);
    if (n.handoffTo) personaSet.add(n.handoffTo);
  }
  if (personaSet.size === 0) {
    for (const s of projectSessions) {
      personaSet.add(s.personaType);
    }
    for (const n of projectNotes) {
      personaSet.add(n.authorId);
    }
  }

  if (personaSet.size === 0) return [];

  const results: AgentAutonomyMetrics[] = [];
  for (const personaId of personaSet) {
    results.push(computeAutonomyMetrics(personaId, projectTickets, projectNotes));
  }
  results.sort((a, b) => b.autonomyScore - a.autonomyScore);
  return results;
}
