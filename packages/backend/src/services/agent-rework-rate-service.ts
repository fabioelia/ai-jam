import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentReworkMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  reworkedTasks: number;
  reworkRate: number;
  avgReworkCycles: number;
  commonReworkReasons: string[];
  reworkSourceBreakdown: {
    fromReview: number;
    fromQA: number;
    fromAcceptance: number;
  };
  reworkTier: 'clean' | 'acceptable' | 'concerning' | 'problematic';
}

export interface AgentReworkRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgReworkRate: number;
    cleanAgents: number;
    problematicAgents: string[];
  };
  agents: AgentReworkMetrics[];
  insights: string[];
  recommendations: string[];
}

export const FALLBACK_SUMMARY = 'Rework rate analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Focus on first-pass quality to reduce rework.'];

export type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = { id: string; assignedPersona: string | null };

export function reworkTier(reworkRate: number): AgentReworkMetrics['reworkTier'] {
  if (reworkRate <= 0.05) return 'clean';
  if (reworkRate <= 0.15) return 'acceptable';
  if (reworkRate <= 0.30) return 'concerning';
  return 'problematic';
}

// Stage that sent the ticket back — derived from handoffFrom field on backward notes
function classifyReworkSource(handoffFrom: string | null): 'fromReview' | 'fromQA' | 'fromAcceptance' | null {
  if (!handoffFrom) return null;
  const f = handoffFrom.toLowerCase();
  if (f.includes('review')) return 'fromReview';
  if (f.includes('qa') || f.includes('quality')) return 'fromQA';
  if (f.includes('accept')) return 'fromAcceptance';
  return null;
}

// Backward statuses that indicate a ticket returned to in_progress
const BACKWARD_FROM_STATUSES = new Set(['review', 'in_review', 'qa', 'quality_assurance', 'acceptance', 'in_acceptance']);

export function buildReworkMetrics(notes: NoteRow[]): {
  agents: AgentReworkMetrics[];
  totalReworkEvents: number;
} {
  // Group notes by ticket, sorted by createdAt
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesByTicket.get(n.ticketId) ?? [];
    list.push(n);
    notesByTicket.set(n.ticketId, list);
  }
  for (const list of notesByTicket.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Per-agent accumulator
  interface AgentAcc {
    ticketsWorked: Set<string>;
    reworkTickets: Set<string>; // tickets that had rework
    reworkEvents: number; // total rework events (can be >1 per ticket)
    reworksPerTicket: Map<string, number>;
    sourceBreakdown: { fromReview: number; fromQA: number; fromAcceptance: number };
  }

  const agentMap = new Map<string, AgentAcc>();

  const getAcc = (agentId: string): AgentAcc => {
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        ticketsWorked: new Set(),
        reworkTickets: new Set(),
        reworkEvents: 0,
        reworksPerTicket: new Map(),
        sourceBreakdown: { fromReview: 0, fromQA: 0, fromAcceptance: 0 },
      });
    }
    return agentMap.get(agentId)!;
  };

  let totalReworkEvents = 0;

  for (const [, ticketNoteList] of notesByTicket.entries()) {
    for (const note of ticketNoteList) {
      if (note.handoffTo && note.handoffFrom) {
        const fromLower = note.handoffFrom.toLowerCase();
        const isBackward = BACKWARD_FROM_STATUSES.has(fromLower) ||
          fromLower.includes('review') ||
          fromLower.includes('qa') ||
          fromLower.includes('quality') ||
          fromLower.includes('accept');

        if (isBackward) {
          const agent = note.handoffTo;
          const acc = getAcc(agent);
          acc.ticketsWorked.add(note.ticketId);
          acc.reworkTickets.add(note.ticketId);
          acc.reworkEvents++;
          acc.reworksPerTicket.set(note.ticketId, (acc.reworksPerTicket.get(note.ticketId) ?? 0) + 1);
          totalReworkEvents++;

          const src = classifyReworkSource(note.handoffFrom);
          if (src) acc.sourceBreakdown[src]++;
        }
      }

      if (note.handoffTo) {
        const agent = note.handoffTo;
        const acc = getAcc(agent);
        acc.ticketsWorked.add(note.ticketId);
      }
    }
  }

  for (const [ticketId, ticketNoteList] of notesByTicket.entries()) {
    const seenAuthors = new Set<string>();
    for (const note of ticketNoteList) {
      if (note.authorId && !seenAuthors.has(note.authorId)) {
        seenAuthors.add(note.authorId);
        const acc = getAcc(note.authorId);
        acc.ticketsWorked.add(ticketId);
      }
    }
  }

  const agents: AgentReworkMetrics[] = [];
  for (const [agentId, acc] of agentMap.entries()) {
    const totalTasks = acc.ticketsWorked.size;
    const reworkedTasks = acc.reworkTickets.size;
    const reworkRate = totalTasks > 0 ? reworkedTasks / totalTasks : 0;
    const avgReworkCycles = totalTasks > 0 ? acc.reworkEvents / totalTasks : 0;

    agents.push({
      agentId,
      agentName: agentId,
      totalTasks,
      reworkedTasks,
      reworkRate: Math.round(reworkRate * 1000) / 1000,
      avgReworkCycles: Math.round(avgReworkCycles * 10) / 10,
      commonReworkReasons: [],
      reworkSourceBreakdown: { ...acc.sourceBreakdown },
      reworkTier: reworkTier(reworkRate),
    });
  }

  // Sort by reworkRate ascending (lowest rework = best at top)
  agents.sort((a, b) => a.reworkRate - b.reworkRate);

  return { agents, totalReworkEvents };
}

export async function analyzeAgentReworkRate(projectId: string): Promise<AgentReworkRateReport> {
  const projectTickets: TicketRow[] = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona })
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

  const { agents } = buildReworkMetrics(allNotes);

  const avgReworkRate = agents.length > 0
    ? Math.round((agents.reduce((s, a) => s + a.reworkRate, 0) / agents.length) * 1000) / 1000
    : 0;

  const cleanAgents = agents.filter(a => a.reworkTier === 'clean').length;
  const problematicAgents = agents.filter(a => a.reworkTier === 'problematic').map(a => a.agentName);

  const insights: string[] = [];
  if (problematicAgents.length > 0) insights.push(`${problematicAgents.length} agent(s) have problematic rework rates (>30%)`);
  if (cleanAgents > 0) insights.push(`${cleanAgents} agent(s) have clean rework rates (≤5%)`);

  const recommendations: string[] = [];
  if (problematicAgents.length > 0) recommendations.push('Review tasks assigned to problematic agents for quality issues');

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgReworkRate,
      cleanAgents,
      problematicAgents,
    },
    agents,
    insights,
    recommendations,
  };
}
