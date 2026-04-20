import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentReworkMetrics {
  personaId: string;
  totalTicketsWorked: number;
  reworkCount: number;
  reworkRate: number;
  avgReworksPerTicket: number;
  reworkSourceBreakdown: {
    fromReview: number;
    fromQA: number;
    fromAcceptance: number;
  };
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ReworkRateReport {
  agents: AgentReworkMetrics[];
  systemReworkRate: number;
  lowestReworkAgent: string | null;
  highestReworkAgent: string | null;
  totalReworkEvents: number;
  aiSummary: string;
  aiRecommendations: string[];
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

export function qualityTier(reworkRate: number): AgentReworkMetrics['qualityTier'] {
  if (reworkRate < 10) return 'excellent';
  if (reworkRate < 25) return 'good';
  if (reworkRate < 50) return 'fair';
  return 'poor';
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

  // Detect rework: a note with handoffFrom indicating a backward stage transition
  // This means the ticket went from review/qa/acceptance back to in_progress and was re-assigned
  // We look for notes where handoffFrom is a "forward" stage (review, qa, acceptance)
  // and handoffTo is set to an agent (indicating re-assignment back)
  for (const [, ticketNoteList] of notesByTicket.entries()) {
    for (const note of ticketNoteList) {
      // A backward handoff: handoffFrom is a review/qa/acceptance stage
      // handoffTo is the agent being re-assigned (rework)
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

      // Also track any agent who received a regular handoff (to get total tickets worked)
      if (note.handoffTo) {
        const agent = note.handoffTo;
        const acc = getAcc(agent);
        acc.ticketsWorked.add(note.ticketId);
      }
    }
  }

  // Also count tickets that agents were assigned to via notes authored by agents
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
  for (const [personaId, acc] of agentMap.entries()) {
    const totalTicketsWorked = acc.ticketsWorked.size;
    const reworkCount = acc.reworkTickets.size;
    const reworkRate = totalTicketsWorked > 0 ? (reworkCount / totalTicketsWorked) * 100 : 0;
    const avgReworksPerTicket = totalTicketsWorked > 0 ? acc.reworkEvents / totalTicketsWorked : 0;

    agents.push({
      personaId,
      totalTicketsWorked,
      reworkCount,
      reworkRate: Math.round(reworkRate * 10) / 10,
      avgReworksPerTicket: Math.round(avgReworksPerTicket * 10) / 10,
      reworkSourceBreakdown: { ...acc.sourceBreakdown },
      qualityTier: qualityTier(reworkRate),
    });
  }

  // Sort by reworkRate ascending (lowest rework = best at top)
  agents.sort((a, b) => a.reworkRate - b.reworkRate);

  return { agents, totalReworkEvents };
}

export async function analyzeReworkRate(projectId: string): Promise<ReworkRateReport> {
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

  const { agents, totalReworkEvents } = buildReworkMetrics(allNotes);

  const totalWorked = agents.reduce((s, a) => s + a.totalTicketsWorked, 0);
  const totalReworks = agents.reduce((s, a) => s + a.reworkCount, 0);
  const systemReworkRate = totalWorked > 0 ? Math.round((totalReworks / totalWorked) * 100 * 10) / 10 : 0;

  const lowestReworkAgent = agents.length > 0 ? agents[0].personaId : null;
  const highestReworkAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(a =>
        `${a.personaId}: reworkRate=${a.reworkRate}%, totalWorked=${a.totalTicketsWorked}, reworkCount=${a.reworkCount}, tier=${a.qualityTier}`,
      )
      .join('\n');

    const prompt = `Analyze this agent rework rate data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall rework rate health\n- recommendations: array of 2-3 actionable recommendations to reduce rework\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Rework rate AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    systemReworkRate,
    lowestReworkAgent,
    highestReworkAgent,
    totalReworkEvents,
    aiSummary,
    aiRecommendations,
  };
}
