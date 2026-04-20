import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface BlockerBreakdown {
  waitingForInfo: number;
  dependencyBlocked: number;
  reviewBlocked: number;
  clarificationNeeded: number;
  other: number;
}

export interface AgentBlockerMetrics {
  personaId: string;
  totalBlockerEvents: number;
  avgBlockerDuration: number; // ms
  blockerFrequencyScore: number; // 0-100, lower = better
  blockerBreakdown: BlockerBreakdown;
  blockerSeverityTier: 'minimal' | 'manageable' | 'significant' | 'critical';
}

export interface BlockerFrequencyReport {
  agents: AgentBlockerMetrics[];
  systemAvgBlockerRate: number;
  mostBlockedAgent: string | null;
  leastBlockedAgent: string | null;
  totalBlockerEvents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Blocker frequency analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Identify and resolve recurring blockers to improve agent throughput.'];

export type NoteRow = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
};

type TicketRow = { id: string; assignedPersona: string | null; createdAt: Date; updatedAt: Date };

export function computeSeverityTier(score: number): AgentBlockerMetrics['blockerSeverityTier'] {
  if (score < 10) return 'minimal';
  if (score < 30) return 'manageable';
  if (score < 60) return 'significant';
  return 'critical';
}

const BLOCKER_KEYWORDS = {
  waitingForInfo: /waiting for (info|information|input|response|feedback|answer|reply)/i,
  dependencyBlocked: /blocked (by|on)|dependency|depends on|waiting on (ticket|task|pr|deploy)/i,
  reviewBlocked: /waiting for (review|approval|sign-?off|merge)/i,
  clarificationNeeded: /need(s)? clarif|unclear|ambiguous|need(s)? more (detail|context|info)/i,
};

export function classifyBlocker(content: string): keyof BlockerBreakdown {
  if (BLOCKER_KEYWORDS.waitingForInfo.test(content)) return 'waitingForInfo';
  if (BLOCKER_KEYWORDS.dependencyBlocked.test(content)) return 'dependencyBlocked';
  if (BLOCKER_KEYWORDS.reviewBlocked.test(content)) return 'reviewBlocked';
  if (BLOCKER_KEYWORDS.clarificationNeeded.test(content)) return 'clarificationNeeded';
  return 'other';
}

export function buildBlockerProfiles(notes: NoteRow[], ticketRows: TicketRow[]): AgentBlockerMetrics[] {
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesByTicket.get(n.ticketId) ?? [];
    list.push(n);
    notesByTicket.set(n.ticketId, list);
  }
  for (const list of notesByTicket.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const ticketMap = new Map<string, TicketRow>();
  for (const t of ticketRows) ticketMap.set(t.id, t);

  // Identify agents from handoffTo assignments
  const agentSet = new Set<string>();
  for (const n of notes) {
    if (n.handoffTo) agentSet.add(n.handoffTo);
    if (n.handoffFrom) agentSet.add(n.handoffFrom);
  }
  // Also include assignedPersona
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }

  interface AgentStats {
    blockerEvents: Array<{ category: keyof BlockerBreakdown; durationMs: number }>;
    totalAssignments: number;
  }

  const agentStats = new Map<string, AgentStats>();
  const getStats = (id: string): AgentStats => {
    if (!agentStats.has(id)) agentStats.set(id, { blockerEvents: [], totalAssignments: 0 });
    return agentStats.get(id)!;
  };

  // Initialize agents
  for (const agentId of agentSet) getStats(agentId);

  // Scan handoff chains: detect blockers as re-handoffs within short windows
  // A blocker event = note content mentions blocker keywords, attributed to current assignee
  for (const [, ticketNoteList] of notesByTicket.entries()) {
    // Track current assignee based on handoffTo events
    let currentAgent: string | null = null;
    let handoffTime: number | null = null;

    for (let i = 0; i < ticketNoteList.length; i++) {
      const n = ticketNoteList[i];

      if (n.handoffTo) {
        currentAgent = n.handoffTo;
        handoffTime = new Date(n.createdAt).getTime();
        getStats(currentAgent).totalAssignments++;
        continue;
      }

      // Check if note content indicates a blocker
      const isBlockerNote =
        /blocked|blocker|waiting for|depends on|clarif|stuck|can't proceed|cannot proceed/i.test(n.content);

      if (isBlockerNote && currentAgent && n.authorId === currentAgent) {
        const category = classifyBlocker(n.content);

        // Duration: time until next note by same agent or end of ticket window
        const subsequentNotes = ticketNoteList.slice(i + 1);
        const nextAgentNote = subsequentNotes.find(
          (sn) => sn.authorId === currentAgent || sn.handoffFrom === currentAgent,
        );
        const blockerStart = new Date(n.createdAt).getTime();
        const blockerEnd = nextAgentNote
          ? new Date(nextAgentNote.createdAt).getTime()
          : handoffTime !== null
            ? blockerStart + 60 * 60 * 1000 // default 1h if no resolution found
            : blockerStart;

        getStats(currentAgent).blockerEvents.push({
          category,
          durationMs: Math.max(0, blockerEnd - blockerStart),
        });
      }
    }
  }

  const profiles: AgentBlockerMetrics[] = [];

  for (const [personaId, stats] of agentStats.entries()) {
    const totalBlockerEvents = stats.blockerEvents.length;
    const avgBlockerDuration =
      totalBlockerEvents > 0
        ? Math.round(
            stats.blockerEvents.reduce((s, e) => s + e.durationMs, 0) / totalBlockerEvents,
          )
        : 0;

    // blockerFrequencyScore: blockers per assignment * 100, capped at 100
    const blockerFrequencyScore =
      stats.totalAssignments > 0
        ? Math.min(100, Math.round((totalBlockerEvents / stats.totalAssignments) * 100))
        : 0;

    const blockerBreakdown: BlockerBreakdown = {
      waitingForInfo: 0,
      dependencyBlocked: 0,
      reviewBlocked: 0,
      clarificationNeeded: 0,
      other: 0,
    };
    for (const e of stats.blockerEvents) blockerBreakdown[e.category]++;

    profiles.push({
      personaId,
      totalBlockerEvents,
      avgBlockerDuration,
      blockerFrequencyScore,
      blockerBreakdown,
      blockerSeverityTier: computeSeverityTier(blockerFrequencyScore),
    });
  }

  profiles.sort((a, b) => b.blockerFrequencyScore - a.blockerFrequencyScore);
  return profiles;
}

export async function analyzeAgentBlockerFrequency(projectId: string): Promise<BlockerFrequencyReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allNotes: NoteRow[] = [];

  if (ticketIds.length > 0) {
    allNotes = await db
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
  }

  const agents = buildBlockerProfiles(allNotes, projectTickets);

  const totalBlockerEvents = agents.reduce((s, a) => s + a.totalBlockerEvents, 0);
  const systemAvgBlockerRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.blockerFrequencyScore, 0) / agents.length)
      : 0;

  const mostBlockedAgent = agents.length > 0 ? agents[0].personaId : null;
  const leastBlockedAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

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
          `${a.personaId}: tier=${a.blockerSeverityTier}, score=${a.blockerFrequencyScore}, events=${a.totalBlockerEvents}`,
      )
      .join('\n');

    const prompt = `Analyze this agent blocker frequency data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall blocker health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Blocker frequency AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    systemAvgBlockerRate,
    mostBlockedAgent,
    leastBlockedAgent,
    totalBlockerEvents,
    aiSummary,
    aiRecommendations,
  };
}
