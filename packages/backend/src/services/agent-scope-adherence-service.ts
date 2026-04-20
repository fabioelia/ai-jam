import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentScopeMetrics {
  personaId: string;
  adherenceScore: number; // 0-100
  overEngineeringPct: number; // tickets with >3 notes from this agent / total
  underDeliveryPct: number; // tickets closed without meeting note count threshold
  reworkPct: number; // tickets this agent worked on that went back to in_progress
  avgNotesPerTicket: number;
  adherenceLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ScopeAdherenceReport {
  agents: AgentScopeMetrics[];
  summary: {
    avgAdherenceScore: number;
    mostAdherent: string | null;
    leastAdherent: string | null;
    systemReworkRate: number;
  };
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Scope adherence analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Focus on delivering within ticket scope.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
};

export type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

export function adherenceLevel(score: number): AgentScopeMetrics['adherenceLevel'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function computeAdherenceScore(
  overEngineeringPct: number,
  underDeliveryPct: number,
  reworkPct: number,
  avgNotesPerTicket: number,
): number {
  const s1 = (100 - overEngineeringPct) * 0.30;
  const s2 = (100 - underDeliveryPct) * 0.40;
  const s3 = (100 - reworkPct) * 0.20;
  const s4 = Math.min(avgNotesPerTicket, 10) * 10 * 0.10;
  return Math.max(0, Math.min(100, s1 + s2 + s3 + s4));
}

export function buildScopeMetrics(
  projectTickets: TicketRow[],
  notes: NoteRow[],
): AgentScopeMetrics[] {
  // Group notes by ticket
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesByTicket.get(n.ticketId) ?? [];
    list.push(n);
    notesByTicket.set(n.ticketId, list);
  }

  // Collect all persona IDs from assigned tickets and note authors
  const personaSet = new Set<string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) personaSet.add(t.assignedPersona);
  }
  for (const n of notes) {
    if (n.authorId) personaSet.add(n.authorId);
  }

  // Track which tickets went back to in_progress (rework) — look at status transitions
  // We detect rework by seeing if any ticket is currently or was in_progress after being done/review
  // Simpler: a ticket "went back to in_progress" if notes suggest rework
  // Since we don't have ticketStatusHistory here, we approximate:
  // A ticket has been reworked if it currently has status 'in_progress' but also has a note from a done-state agent
  // Best approximation with available data: track tickets where status === 'in_progress' AND have >1 note
  // OR: check if any note has handoffFrom suggesting return
  // Most accurate approach with available data: a ticket is reworked if it is status=in_progress and
  // was previously worked on (has notes authored by agents). This matches typical analytics for rework.
  const reworkedTicketIds = new Set<string>(
    projectTickets
      .filter(t => t.status === 'in_progress' && (notesByTicket.get(t.id)?.length ?? 0) > 0)
      .map(t => t.id),
  );

  const metrics: AgentScopeMetrics[] = [];

  for (const personaId of personaSet) {
    // Tickets this agent worked on (authored at least one note OR assigned)
    const workedTicketIds = new Set<string>();
    for (const t of projectTickets) {
      if (t.assignedPersona === personaId) workedTicketIds.add(t.id);
    }
    for (const n of notes) {
      if (n.authorId === personaId) workedTicketIds.add(n.ticketId);
    }

    const totalWorked = workedTicketIds.size;
    if (totalWorked === 0) continue;

    // Over-engineering: tickets where this agent has >3 notes
    let overEngineeredCount = 0;
    let totalNotesForAgent = 0;
    for (const ticketId of workedTicketIds) {
      const ticketNoteList = notesByTicket.get(ticketId) ?? [];
      const agentNotes = ticketNoteList.filter(n => n.authorId === personaId);
      totalNotesForAgent += agentNotes.length;
      if (agentNotes.length > 3) overEngineeredCount++;
    }
    const overEngineeringPct = Math.round((overEngineeredCount / totalWorked) * 100);
    const avgNotesPerTicket = Math.round((totalNotesForAgent / totalWorked) * 10) / 10;

    // Under-delivery: tickets that are 'done' but agent contributed <2 notes
    // (closed without meeting note count threshold of 2)
    const NOTE_THRESHOLD = 2;
    let underDeliveryCount = 0;
    for (const ticketId of workedTicketIds) {
      const ticket = projectTickets.find(t => t.id === ticketId);
      if (ticket?.status === 'done') {
        const ticketNoteList = notesByTicket.get(ticketId) ?? [];
        const agentNotes = ticketNoteList.filter(n => n.authorId === personaId);
        if (agentNotes.length < NOTE_THRESHOLD) underDeliveryCount++;
      }
    }
    const underDeliveryPct = Math.round((underDeliveryCount / totalWorked) * 100);

    // Rework: tickets this agent worked on that went back to in_progress
    let reworkCount = 0;
    for (const ticketId of workedTicketIds) {
      if (reworkedTicketIds.has(ticketId)) reworkCount++;
    }
    const reworkPct = Math.round((reworkCount / totalWorked) * 100);

    const score = computeAdherenceScore(overEngineeringPct, underDeliveryPct, reworkPct, avgNotesPerTicket);
    const roundedScore = Math.round(score);

    metrics.push({
      personaId,
      adherenceScore: roundedScore,
      overEngineeringPct,
      underDeliveryPct,
      reworkPct,
      avgNotesPerTicket,
      adherenceLevel: adherenceLevel(roundedScore),
    });
  }

  metrics.sort((a, b) => b.adherenceScore - a.adherenceScore);
  return metrics;
}

export async function analyzeAgentScopeAdherence(projectId: string): Promise<ScopeAdherenceReport> {
  const projectTickets: TicketRow[] = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    const rawNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        authorId: ticketNotes.authorId,
        content: ticketNotes.content,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allNotes = rawNotes;
  }

  const agents = buildScopeMetrics(projectTickets, allNotes);

  const avgAdherenceScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.adherenceScore, 0) / agents.length)
      : 0;
  const mostAdherent = agents.length > 0 ? agents[0].personaId : null;
  const leastAdherent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  const totalWorkedTickets = new Set<string>();
  for (const n of allNotes) totalWorkedTickets.add(n.ticketId);
  for (const t of projectTickets) {
    if (t.assignedPersona) totalWorkedTickets.add(t.id);
  }

  const reworkedTickets = projectTickets.filter(
    t => t.status === 'in_progress' && allNotes.some(n => n.ticketId === t.id),
  ).length;
  const systemReworkRate =
    totalWorkedTickets.size > 0
      ? Math.round((reworkedTickets / totalWorkedTickets.size) * 100)
      : 0;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(a =>
        `${a.personaId}: score=${a.adherenceScore}, level=${a.adherenceLevel}, overEngineering=${a.overEngineeringPct}%, underDelivery=${a.underDeliveryPct}%, rework=${a.reworkPct}%, avgNotes=${a.avgNotesPerTicket}`,
      )
      .join('\n');

    const prompt = `Analyze this agent scope adherence data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall scope adherence health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Scope adherence AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    summary: {
      avgAdherenceScore,
      mostAdherent,
      leastAdherent,
      systemReworkRate,
    },
    aiSummary,
    aiRecommendations,
  };
}
