import { db } from '../db/connection.js';
import { tickets, ticketNotes, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentTokenBudgetMetrics {
  personaId: string;
  sessionCount: number;
  handoffsInitiated: number;
  ticketsCompleted: number;
  ticketNoteAvgLength: number;
  handoffNoteAvgLength: number;
  estimatedTokens: number;
  tokensPerTicket: number;
  efficiencyScore: number;
  efficiencyTier: 'optimal' | 'efficient' | 'moderate' | 'expensive';
}

export interface AgentTokenBudgetReport {
  agents: AgentTokenBudgetMetrics[];
  totalEstimatedTokens: number;
  avgTokensPerTicket: number;
  mostEfficientAgent: string | null;
  leastEfficientAgent: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Token budget analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Monitor token usage per ticket to identify inefficient agents.'];

export function computeEfficiencyTier(score: number): AgentTokenBudgetMetrics['efficiencyTier'] {
  if (score >= 75) return 'optimal';
  if (score >= 50) return 'efficient';
  if (score >= 25) return 'moderate';
  return 'expensive';
}

export function computeEfficiencyScore(tokensPerTicket: number): number {
  return Math.max(0, 100 - tokensPerTicket / 100);
}

export function estimateTokens(
  sessionCount: number,
  handoffsInitiated: number,
  handoffNoteAvgLength: number,
  ticketNoteAvgLength: number,
  ticketsCompleted: number,
): number {
  return Math.round(
    sessionCount * 500 +
      (handoffsInitiated * handoffNoteAvgLength) / 4 +
      (ticketNoteAvgLength * ticketsCompleted) / 4,
  );
}

type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
};

type TicketRow = { id: string; assignedPersona: string | null; status: string };
type SessionRow = { personaType: string };

export function buildTokenBudgetProfiles(
  notes: NoteRow[],
  ticketRows: TicketRow[],
  sessionRows: SessionRow[],
): AgentTokenBudgetMetrics[] {
  // Identify all agents
  const agentSet = new Set<string>();
  for (const n of notes) {
    if (n.handoffTo) agentSet.add(n.handoffTo);
    if (n.handoffFrom) agentSet.add(n.handoffFrom);
    if (n.authorId) agentSet.add(n.authorId);
  }
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }
  for (const s of sessionRows) {
    if (s.personaType) agentSet.add(s.personaType);
  }

  interface AgentAccum {
    sessionCount: number;
    handoffsInitiated: number;
    ticketsCompleted: number;
    ticketNoteLengths: number[];
    handoffNoteLengths: number[];
  }

  const accum = new Map<string, AgentAccum>();
  const get = (id: string): AgentAccum => {
    if (!accum.has(id)) {
      accum.set(id, {
        sessionCount: 0,
        handoffsInitiated: 0,
        ticketsCompleted: 0,
        ticketNoteLengths: [],
        handoffNoteLengths: [],
      });
    }
    return accum.get(id)!;
  };

  for (const agentId of agentSet) get(agentId);

  // Session counts
  for (const s of sessionRows) {
    if (s.personaType) get(s.personaType).sessionCount++;
  }

  // Ticket completion
  for (const t of ticketRows) {
    if (t.assignedPersona && t.status === 'done') {
      get(t.assignedPersona).ticketsCompleted++;
    }
  }

  // Notes
  for (const n of notes) {
    const isHandoff = n.handoffFrom !== null;
    if (isHandoff) {
      get(n.handoffFrom!).handoffsInitiated++;
      get(n.handoffFrom!).handoffNoteLengths.push(n.content.length);
    } else if (n.authorId) {
      get(n.authorId).ticketNoteLengths.push(n.content.length);
    }
  }

  const profiles: AgentTokenBudgetMetrics[] = [];

  for (const [personaId, a] of accum.entries()) {
    const ticketNoteAvgLength =
      a.ticketNoteLengths.length > 0
        ? Math.round(a.ticketNoteLengths.reduce((s, v) => s + v, 0) / a.ticketNoteLengths.length)
        : 0;
    const handoffNoteAvgLength =
      a.handoffNoteLengths.length > 0
        ? Math.round(a.handoffNoteLengths.reduce((s, v) => s + v, 0) / a.handoffNoteLengths.length)
        : 0;

    const estimatedTokens = estimateTokens(
      a.sessionCount,
      a.handoffsInitiated,
      handoffNoteAvgLength,
      ticketNoteAvgLength,
      a.ticketsCompleted,
    );

    const tokensPerTicket = Math.round(estimatedTokens / Math.max(a.ticketsCompleted, 1));
    const efficiencyScore = Math.round(computeEfficiencyScore(tokensPerTicket));

    profiles.push({
      personaId,
      sessionCount: a.sessionCount,
      handoffsInitiated: a.handoffsInitiated,
      ticketsCompleted: a.ticketsCompleted,
      ticketNoteAvgLength,
      handoffNoteAvgLength,
      estimatedTokens,
      tokensPerTicket,
      efficiencyScore,
      efficiencyTier: computeEfficiencyTier(efficiencyScore),
    });
  }

  // Sort by efficiencyScore descending (most efficient first)
  profiles.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  return profiles;
}

export async function analyzeAgentTokenBudget(projectId: string): Promise<AgentTokenBudgetReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allNotes: NoteRow[] = [];
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        authorId: ticketNotes.authorId,
        content: ticketNotes.content,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    allSessions = await db
      .select({ personaType: agentSessions.personaType })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildTokenBudgetProfiles(allNotes, projectTickets, allSessions);

  const totalEstimatedTokens = agents.reduce((s, a) => s + a.estimatedTokens, 0);
  const avgTokensPerTicket =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.tokensPerTicket, 0) / agents.length)
      : 0;

  const mostEfficientAgent = agents.length > 0 ? agents[0].personaId : null;
  const leastEfficientAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.personaId}: tier=${a.efficiencyTier}, score=${a.efficiencyScore}, estimatedTokens=${a.estimatedTokens}, tokensPerTicket=${a.tokensPerTicket}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent token budget data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall token budget health\n- recommendations: array of 2-3 actionable recommendations to reduce token usage\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Token budget AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    totalEstimatedTokens,
    avgTokensPerTicket,
    mostEfficientAgent,
    leastEfficientAgent,
    aiSummary,
    aiRecommendations,
  };
}
