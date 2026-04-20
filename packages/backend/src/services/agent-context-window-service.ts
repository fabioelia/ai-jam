import { db } from '../db/connection.js';
import { tickets, agentSessions, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextWindowMetrics {
  agentId: string;
  agentName: string;
  avgWindowUsage: number; // 0-100
  peakUsage: number;
  windowOverflows: number;
  contextEfficiencyScore: number; // 0-100
  utilizationTier: 'optimal' | 'efficient' | 'wasteful' | 'overloaded';
}

export interface AgentContextWindowReport {
  projectId: string;
  agents: AgentContextWindowMetrics[];
  avgWindowUsage: number;
  totalOverflows: number;
  optimalAgents: number;
  overloadedAgents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Context window utilization analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Monitor agents with high overflow counts and reduce note verbosity.',
  'Consider splitting complex sessions into smaller, focused interactions.',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// computeUtilizationScore per FEAT-111 spec
export function computeUtilizationScore(avgUtilizationRate: number, overflowSessions: number, totalSessions: number): number {
  let score = 100 - Math.abs(avgUtilizationRate - 70) * 1.5;
  if (overflowSessions > totalSessions * 0.2) score -= 20;
  if (avgUtilizationRate >= 60 && avgUtilizationRate <= 80) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeContextEfficiencyScore(
  avgWindowUsage: number,
  windowOverflows: number,
): number {
  const overflowPenalty = Math.max(0, 20 - windowOverflows * 5);
  const noOverflowBonus = windowOverflows === 0 ? 20 : 0;
  return clamp(
    Math.round(avgWindowUsage * 0.6 + noOverflowBonus + overflowPenalty),
    0,
    100,
  );
}

export function computeUtilizationTier(
  score: number,
): AgentContextWindowMetrics['utilizationTier'] {
  if (score >= 80) return 'optimal';
  if (score >= 60) return 'efficient';
  if (score >= 40) return 'wasteful';
  return 'overloaded';
}

type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string | null;
};

type SessionRow = {
  id: string;
  ticketId: string | null;
  personaType: string;
  status: string;
};

export function buildContextWindowMetrics(
  allSessions: SessionRow[],
  notesByTicket: Map<string, number>,
): AgentContextWindowMetrics[] {
  // Group sessions by personaType
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const metrics: AgentContextWindowMetrics[] = [];

  for (const [personaType, agentSessionList] of sessionsByPersona.entries()) {
    const sessionUsages: number[] = [];

    for (const session of agentSessionList) {
      const notesCount = notesByTicket.get(session.ticketId ?? '') ?? 0;
      const usage = notesCount * 10; // 10% per note
      sessionUsages.push(usage);
    }

    const totalSessions = sessionUsages.length;
    const avgWindowUsage =
      totalSessions > 0
        ? Math.round(sessionUsages.reduce((s, u) => s + u, 0) / totalSessions)
        : 0;
    const peakUsage = sessionUsages.length > 0 ? Math.max(...sessionUsages) : 0;
    // Overflow = session where notes > 20 (i.e. usage > 200, but capped: usage = count * 10, overflow at count > 20)
    // Using raw notesCount > 20
    const windowOverflows = agentSessionList.filter((session) => {
      const notesCount = notesByTicket.get(session.ticketId ?? '') ?? 0;
      return notesCount > 20;
    }).length;

    const contextEfficiencyScore = computeContextEfficiencyScore(
      avgWindowUsage,
      windowOverflows,
    );

    const agentName =
      personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' ');

    metrics.push({
      agentId: personaType,
      agentName,
      avgWindowUsage: clamp(avgWindowUsage, 0, 100),
      peakUsage: clamp(peakUsage, 0, 100),
      windowOverflows,
      contextEfficiencyScore,
      utilizationTier: computeUtilizationTier(contextEfficiencyScore),
    });
  }

  metrics.sort((a, b) => b.contextEfficiencyScore - a.contextEfficiencyScore);
  return metrics;
}

export async function analyzeAgentContextWindow(
  projectId: string,
): Promise<AgentContextWindowReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));

    allNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        authorId: ticketNotes.authorId,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      agents: [],
      avgWindowUsage: 0,
      totalOverflows: 0,
      optimalAgents: 0,
      overloadedAgents: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Build note counts per ticketId
  const notesByTicket = new Map<string, number>();
  for (const note of allNotes) {
    notesByTicket.set(note.ticketId, (notesByTicket.get(note.ticketId) ?? 0) + 1);
  }

  const agents = buildContextWindowMetrics(allSessions, notesByTicket);

  const avgWindowUsage =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.avgWindowUsage, 0) / agents.length)
      : 0;
  const totalOverflows = agents.reduce((s, a) => s + a.windowOverflows, 0);
  const optimalAgents = agents.filter((a) => a.utilizationTier === 'optimal').length;
  const overloadedAgents = agents.filter((a) => a.utilizationTier === 'overloaded').length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummaryText = agents
      .slice(0, 8)
      .map(
        (a) =>
          `${a.agentId}: score=${a.contextEfficiencyScore}, tier=${a.utilizationTier}, avgUsage=${a.avgWindowUsage}%, peak=${a.peakUsage}%, overflows=${a.windowOverflows}`,
      )
      .join('\n');

    const prompt = `Analyze the context window utilization of AI agents:\n${agentSummaryText}\n\nProject: avgUsage=${avgWindowUsage}%, totalOverflows=${totalOverflows}, optimalAgents=${optimalAgents}, overloadedAgents=${overloadedAgents}\n\nProvide:\n1. A summary paragraph about context window utilization health\n2. 2-3 specific recommendations\n\nFormat as JSON: {"summary": "...", "recommendations": ["...", "..."]}`;

    const msg = await client.messages.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      try {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
        const parsed = JSON.parse(jsonStr);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Context window AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    avgWindowUsage,
    totalOverflows,
    optimalAgents,
    overloadedAgents,
    aiSummary,
    aiRecommendations,
  };
}
