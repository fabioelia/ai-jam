import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface ChainTicket {
  ticketId: string;
  title: string;
  chainDepth: number; // number of distinct handoffs
  agentSequence: string[]; // ordered list of agents
}

export interface AgentChainStats {
  personaId: string;
  passAlongRate: number; // pct of received tickets they passed on
  avgChainDepthInvolved: number;
  totalHandoffsReceived: number;
  totalHandoffsGiven: number;
}

export interface HandoffChainReport {
  deepChainTickets: ChainTicket[]; // sorted by chainDepth desc
  agentStats: AgentChainStats[]; // sorted by passAlongRate desc
  summary: {
    avgChainDepth: number;
    maxChainDepth: number;
    totalTicketsAnalyzed: number;
    mostCommonChainPath: string; // e.g., "agent-a → agent-b → agent-c"
  };
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Handoff chain depth analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Reduce chain depth for complex tickets.'];

export type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = { id: string; title: string };

export function buildChainReport(
  tickets: TicketRow[],
  notes: NoteRow[],
): {
  deepChainTickets: ChainTicket[];
  agentStats: AgentChainStats[];
  summary: HandoffChainReport['summary'];
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

  const ticketMap = new Map<string, string>();
  for (const t of tickets) {
    ticketMap.set(t.id, t.title);
  }

  const deepChainTickets: ChainTicket[] = [];
  const pathCounts = new Map<string, number>();

  // Per-agent: received and given
  const agentReceived = new Map<string, number>();
  const agentGiven = new Map<string, number>();
  const agentChainDepthSum = new Map<string, number>();
  const agentChainDepthCount = new Map<string, number>();

  for (const [ticketId, ticketNoteList] of notesByTicket.entries()) {
    // Build agent sequence from handoff notes
    const handoffNotes = ticketNoteList.filter(n => n.handoffTo != null);

    if (handoffNotes.length === 0) continue;

    // Build ordered agent sequence: first agent is handoffFrom of first handoff note (or authorId), then each handoffTo
    const agentSequence: string[] = [];

    for (const n of handoffNotes) {
      const from = n.handoffFrom ?? n.authorId;
      const to = n.handoffTo!;

      if (agentSequence.length === 0) {
        agentSequence.push(from);
      }
      agentSequence.push(to);

      // Track given
      agentGiven.set(from, (agentGiven.get(from) ?? 0) + 1);
      // Track received
      agentReceived.set(to, (agentReceived.get(to) ?? 0) + 1);
    }

    const chainDepth = handoffNotes.length;
    const title = ticketMap.get(ticketId) ?? ticketId;

    deepChainTickets.push({ ticketId, title, chainDepth, agentSequence });

    // Track chain path
    const path = agentSequence.join(' → ');
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);

    // For each agent in the sequence, accumulate chain depth involvement
    const uniqueAgents = new Set(agentSequence);
    for (const agent of uniqueAgents) {
      agentChainDepthSum.set(agent, (agentChainDepthSum.get(agent) ?? 0) + chainDepth);
      agentChainDepthCount.set(agent, (agentChainDepthCount.get(agent) ?? 0) + 1);
    }
  }

  // Sort by chainDepth desc
  deepChainTickets.sort((a, b) => b.chainDepth - a.chainDepth);

  // Build agent stats
  const allAgents = new Set([...agentReceived.keys(), ...agentGiven.keys()]);
  const agentStats: AgentChainStats[] = [];

  for (const personaId of allAgents) {
    const totalHandoffsReceived = agentReceived.get(personaId) ?? 0;
    const totalHandoffsGiven = agentGiven.get(personaId) ?? 0;
    const passAlongRate =
      totalHandoffsReceived > 0
        ? Math.round((totalHandoffsGiven / totalHandoffsReceived) * 100)
        : totalHandoffsGiven > 0
        ? 100
        : 0;
    const depthSum = agentChainDepthSum.get(personaId) ?? 0;
    const depthCount = agentChainDepthCount.get(personaId) ?? 0;
    const avgChainDepthInvolved = depthCount > 0 ? Math.round((depthSum / depthCount) * 10) / 10 : 0;

    agentStats.push({
      personaId,
      passAlongRate,
      avgChainDepthInvolved,
      totalHandoffsReceived,
      totalHandoffsGiven,
    });
  }

  agentStats.sort((a, b) => b.passAlongRate - a.passAlongRate);

  // Summary
  const totalTicketsAnalyzed = tickets.length;
  const chainDepths = deepChainTickets.map(t => t.chainDepth);
  const avgChainDepth =
    chainDepths.length > 0
      ? Math.round((chainDepths.reduce((s, d) => s + d, 0) / chainDepths.length) * 10) / 10
      : 0;
  const maxChainDepth = chainDepths.length > 0 ? Math.max(...chainDepths) : 0;

  let mostCommonChainPath = '';
  let maxCount = 0;
  for (const [path, count] of pathCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonChainPath = path;
    }
  }

  return {
    deepChainTickets,
    agentStats,
    summary: {
      avgChainDepth,
      maxChainDepth,
      totalTicketsAnalyzed,
      mostCommonChainPath,
    },
  };
}

export async function analyzeHandoffChainDepth(projectId: string): Promise<HandoffChainReport> {
  const projectTickets: TicketRow[] = await db
    .select({ id: tickets.id, title: tickets.title })
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

  const { deepChainTickets, agentStats, summary } = buildChainReport(projectTickets, allNotes);

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const statsText = agentStats
      .map(
        s =>
          `${s.personaId}: passAlongRate=${s.passAlongRate}%, received=${s.totalHandoffsReceived}, given=${s.totalHandoffsGiven}, avgDepthInvolved=${s.avgChainDepthInvolved}`,
      )
      .join('\n');

    const prompt = `Analyze this agent handoff chain depth data:\nAvg chain depth: ${summary.avgChainDepth}\nMax chain depth: ${summary.maxChainDepth}\nTotal tickets: ${summary.totalTicketsAnalyzed}\nMost common path: ${summary.mostCommonChainPath}\n\nAgent stats:\n${statsText}\n\nReturn JSON with:\n- summary: one paragraph describing overall handoff chain health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Handoff chain depth AI analysis failed, using fallback:', e);
  }

  return {
    deepChainTickets,
    agentStats,
    summary,
    aiSummary,
    aiRecommendations,
  };
}
