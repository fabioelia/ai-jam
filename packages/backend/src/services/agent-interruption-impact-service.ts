import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentInterruptionMetrics {
  personaId: string;
  totalInterruptions: number;
  interruptionRate: number; // interruptions per ticket
  avgCycleTimeWithInterruption: number; // ms
  avgCycleTimeWithoutInterruption: number; // ms
  cycleTimeOverheadPct: number; // pct increase
  recoveryScore: number; // 0-100
  resilienceLevel: 'high' | 'medium' | 'low' | 'fragile';
}

export interface InterruptionImpactReport {
  agents: AgentInterruptionMetrics[];
  systemAvgInterruptionRate: number;
  mostResilient: string | null;
  mostFragile: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Agent interruption impact analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review tickets that regressed to in_progress to identify common blockers.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  createdAt: Date;
  updatedAt: Date;
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

// resilienceLevel tiers
export function resilienceLevel(recoveryScore: number): AgentInterruptionMetrics['resilienceLevel'] {
  if (recoveryScore >= 75) return 'high';
  if (recoveryScore >= 50) return 'medium';
  if (recoveryScore >= 25) return 'low';
  return 'fragile';
}

export function computeRecoveryScore(cycleTimeOverheadPct: number): number {
  return Math.max(0, Math.min(100, 100 - Math.max(0, Math.min(100, cycleTimeOverheadPct))));
}

// An "interruption" is when a ticket moves back from review/qa/acceptance to in_progress.
// We detect this via ticketNotes handoff patterns: a handoffTo back to in_progress agent,
// or by detecting backward handoff flows in notes where an agent receives a ticket again
// after it advanced (note: handoffFrom is the prior stage agent/status indicator).
// Since we don't have a full status history table, we detect interruptions from notes:
// A note with handoffFrom set where the ticket was previously handed forward (advanced) is
// treated as an interruption for the handoffTo persona.
//
// Concretely: an interruption for personaId = a note where:
//   - handoffTo === personaId (agent receives work back)
//   - The ticket already had a note from this agent before (meaning it advanced then came back)
//
// Cycle times: we approximate using note timestamps:
//   - Ticket with interruption: time from first note to last note on that ticket (for this agent)
//   - Ticket without interruption: same, but no backward handoff detected

export interface AnalysisInput {
  projectTickets: TicketRow[];
  notes: NoteRow[];
}

export function buildInterruptionMetrics(input: AnalysisInput): AgentInterruptionMetrics[] {
  const { projectTickets, notes } = input;

  // Build note index by ticket, sorted by createdAt
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesByTicket.get(n.ticketId) ?? [];
    list.push(n);
    notesByTicket.set(n.ticketId, list);
  }
  for (const list of notesByTicket.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Build set of ticket IDs for this project
  const projectTicketIds = new Set(projectTickets.map(t => t.id));

  // Collect all personas from ticket assignments and note authors
  const personaSet = new Set<string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) personaSet.add(t.assignedPersona);
  }
  for (const n of notes) {
    if (n.authorId && projectTicketIds.has(n.ticketId)) personaSet.add(n.authorId);
  }

  interface AgentStats {
    interruptedTicketIds: Set<string>;
    nonInterruptedTicketIds: Set<string>;
    totalTicketIds: Set<string>;
    cycleTimesWithInterruption: number[];
    cycleTimesWithoutInterruption: number[];
    interruptionCount: number;
  }

  const agentStats = new Map<string, AgentStats>();
  const getStats = (id: string): AgentStats => {
    if (!agentStats.has(id)) {
      agentStats.set(id, {
        interruptedTicketIds: new Set(),
        nonInterruptedTicketIds: new Set(),
        totalTicketIds: new Set(),
        cycleTimesWithInterruption: [],
        cycleTimesWithoutInterruption: [],
        interruptionCount: 0,
      });
    }
    return agentStats.get(id)!;
  };

  // Detect interruptions per ticket per agent
  // For each ticket, walk through notes to detect:
  // 1. Has this agent authored a note? (they worked on it)
  // 2. Is there a note where handoffTo === this agent AFTER the agent already authored notes?
  //    => This is an interruption (ticket came back to them)

  for (const [ticketId, ticketNoteList] of notesByTicket.entries()) {
    if (!projectTicketIds.has(ticketId)) continue;

    // For each persona that authored a note on this ticket
    const personasOnTicket = new Set<string>();
    for (const n of ticketNoteList) {
      if (n.authorId) personasOnTicket.add(n.authorId);
    }

    for (const personaId of personasOnTicket) {
      const stats = getStats(personaId);
      stats.totalTicketIds.add(ticketId);

      // Find when this persona first authored a note
      const personaNotes = ticketNoteList.filter(n => n.authorId === personaId);
      if (personaNotes.length === 0) continue;

      const firstNoteTime = new Date(personaNotes[0].createdAt).getTime();
      const lastNoteTime = new Date(personaNotes[personaNotes.length - 1].createdAt).getTime();
      const cycleTime = lastNoteTime - firstNoteTime;

      // Detect interruption: a handoffTo === personaId note that comes AFTER the persona's first note
      // (meaning the ticket was handed back to them)
      const firstPersonaNoteIdx = ticketNoteList.findIndex(n => n.authorId === personaId);
      const hasInterruption = ticketNoteList.some(
        (n, idx) => idx > firstPersonaNoteIdx && n.handoffTo === personaId,
      );

      if (hasInterruption) {
        stats.interruptedTicketIds.add(ticketId);
        stats.interruptionCount++;
        stats.cycleTimesWithInterruption.push(cycleTime);
      } else {
        stats.nonInterruptedTicketIds.add(ticketId);
        stats.cycleTimesWithoutInterruption.push(cycleTime);
      }
    }
  }

  // Also add agents from ticket assignments who have no notes
  for (const t of projectTickets) {
    if (!t.assignedPersona) continue;
    const stats = getStats(t.assignedPersona);
    stats.totalTicketIds.add(t.id);
  }

  const metrics: AgentInterruptionMetrics[] = [];

  for (const [personaId, stats] of agentStats.entries()) {
    const totalTickets = stats.totalTicketIds.size;
    if (totalTickets === 0) continue;

    const totalInterruptions = stats.interruptionCount;
    const interruptionRate = totalTickets > 0 ? totalInterruptions / totalTickets : 0;

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const avgCycleTimeWithInterruption = avg(stats.cycleTimesWithInterruption);
    const avgCycleTimeWithoutInterruption = avg(stats.cycleTimesWithoutInterruption);

    let cycleTimeOverheadPct = 0;
    if (avgCycleTimeWithoutInterruption > 0) {
      cycleTimeOverheadPct =
        ((avgCycleTimeWithInterruption - avgCycleTimeWithoutInterruption) /
          avgCycleTimeWithoutInterruption) *
        100;
    } else if (avgCycleTimeWithInterruption > 0) {
      // No baseline without interruptions — treat overhead as proportional
      cycleTimeOverheadPct = 50; // conservative default
    }

    const recoveryScore = computeRecoveryScore(cycleTimeOverheadPct);

    metrics.push({
      personaId,
      totalInterruptions,
      interruptionRate: Math.round(interruptionRate * 100) / 100,
      avgCycleTimeWithInterruption: Math.round(avgCycleTimeWithInterruption),
      avgCycleTimeWithoutInterruption: Math.round(avgCycleTimeWithoutInterruption),
      cycleTimeOverheadPct: Math.round(cycleTimeOverheadPct * 10) / 10,
      recoveryScore: Math.round(recoveryScore),
      resilienceLevel: resilienceLevel(recoveryScore),
    });
  }

  // Sort by recoveryScore descending
  metrics.sort((a, b) => b.recoveryScore - a.recoveryScore);
  return metrics;
}

export async function analyzeAgentInterruptions(projectId: string): Promise<InterruptionImpactReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
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

  const agents = buildInterruptionMetrics({ projectTickets, notes: allNotes });

  const systemAvgInterruptionRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.interruptionRate, 0) / agents.length) * 100) / 100
      : 0;

  const mostResilient = agents.length > 0 ? agents[0].personaId : null;
  const mostFragile = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        a =>
          `${a.personaId}: interruptions=${a.totalInterruptions}, rate=${a.interruptionRate}/ticket, overhead=${a.cycleTimeOverheadPct}%, recoveryScore=${a.recoveryScore}, resilience=${a.resilienceLevel}`,
      )
      .join('\n');

    const prompt = `Analyze this agent interruption impact data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall interruption impact and resilience health\n- recommendations: array of 2-3 actionable recommendations to reduce interruptions or improve recovery\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Agent interruption AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    systemAvgInterruptionRate,
    mostResilient,
    mostFragile,
    aiSummary,
    aiRecommendations,
  };
}
