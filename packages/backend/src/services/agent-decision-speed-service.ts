import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentDecisionSpeedMetrics {
  personaId: string;
  avgHandoffLatencyMs: number; // avg time from receiving handoff to first action (note creation)
  avgSessionDurationMs: number; // avg time agent spends on a ticket
  avgTurnaroundMs: number; // avg time from ticket assignment to completion/handoff
  decisionVelocity: number; // tickets completed per day (normalized)
  stallRate: number; // pct of assignments where agent took >30min to first action
  speedTier: 'fast' | 'moderate' | 'slow' | 'stalled';
}

export interface DecisionSpeedReport {
  agents: AgentDecisionSpeedMetrics[];
  systemAvgLatencyMs: number;
  fastestAgent: string | null;
  slowestAgent: string | null;
  systemStallRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Decision speed analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Improve response times for stalled agents.'];

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

export function computeSpeedTier(avgHandoffLatencyMs: number): AgentDecisionSpeedMetrics['speedTier'] {
  if (avgHandoffLatencyMs < 60_000) return 'fast';
  if (avgHandoffLatencyMs < 300_000) return 'moderate';
  if (avgHandoffLatencyMs < 1_800_000) return 'slow';
  return 'stalled';
}

export function buildSpeedProfiles(notes: NoteRow[], ticketRows: TicketRow[]): AgentDecisionSpeedMetrics[] {
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

  const ticketMap = new Map<string, TicketRow>();
  for (const t of ticketRows) {
    ticketMap.set(t.id, t);
  }

  interface AgentStats {
    handoffLatencies: number[];
    sessionDurations: number[];
    turnaroundMs: number[];
    stalledCount: number;
    totalAssignments: number;
  }

  const agentStats = new Map<string, AgentStats>();

  const getStats = (agentId: string): AgentStats => {
    if (!agentStats.has(agentId)) {
      agentStats.set(agentId, {
        handoffLatencies: [],
        sessionDurations: [],
        turnaroundMs: [],
        stalledCount: 0,
        totalAssignments: 0,
      });
    }
    return agentStats.get(agentId)!;
  };

  // Find all handoff events: note with handoffTo=agentId, then agent's first subsequent note
  for (const [ticketId, ticketNoteList] of notesByTicket.entries()) {
    for (let i = 0; i < ticketNoteList.length; i++) {
      const n = ticketNoteList[i];
      if (!n.handoffTo) continue;

      const agentId = n.handoffTo;
      const stats = getStats(agentId);
      stats.totalAssignments++;

      const handoffTime = new Date(n.createdAt).getTime();

      // Find agent's first note after this handoff
      const subsequentNotes = ticketNoteList.slice(i + 1);
      const agentFirstNote = subsequentNotes.find(
        (sn) => sn.authorId === agentId || sn.authorId.toLowerCase() === agentId.toLowerCase(),
      );

      if (agentFirstNote) {
        const firstActionTime = new Date(agentFirstNote.createdAt).getTime();
        const latency = firstActionTime - handoffTime;
        stats.handoffLatencies.push(latency);

        // Session duration: time from first action to last note by this agent in the ticket
        const agentNotes = subsequentNotes.filter(
          (sn) => sn.authorId === agentId || sn.authorId.toLowerCase() === agentId.toLowerCase(),
        );
        const lastAgentNote = agentNotes[agentNotes.length - 1];
        if (lastAgentNote) {
          const sessionDuration = new Date(lastAgentNote.createdAt).getTime() - firstActionTime;
          stats.sessionDurations.push(sessionDuration);
        }

        // Stall: latency > 30 minutes
        if (latency > 30 * 60 * 1000) {
          stats.stalledCount++;
        }
      } else {
        // No response — count as stalled
        stats.stalledCount++;
      }

      // Turnaround: from handoff to next handoff-away or ticket updatedAt
      const nextHandoffAway = subsequentNotes.find((sn) => sn.handoffFrom === agentId);
      const ticket = ticketMap.get(ticketId);
      const turnaroundEnd = nextHandoffAway
        ? new Date(nextHandoffAway.createdAt).getTime()
        : ticket
          ? new Date(ticket.updatedAt).getTime()
          : handoffTime;

      const turnaround = Math.max(0, turnaroundEnd - handoffTime);
      stats.turnaroundMs.push(turnaround);
    }
  }

  const profiles: AgentDecisionSpeedMetrics[] = [];

  for (const [personaId, stats] of agentStats.entries()) {
    const avgHandoffLatencyMs =
      stats.handoffLatencies.length > 0
        ? Math.round(stats.handoffLatencies.reduce((a, b) => a + b, 0) / stats.handoffLatencies.length)
        : 0;

    const avgSessionDurationMs =
      stats.sessionDurations.length > 0
        ? Math.round(stats.sessionDurations.reduce((a, b) => a + b, 0) / stats.sessionDurations.length)
        : 0;

    const avgTurnaroundMs =
      stats.turnaroundMs.length > 0
        ? Math.round(stats.turnaroundMs.reduce((a, b) => a + b, 0) / stats.turnaroundMs.length)
        : 0;

    // decisionVelocity: tickets completed per day
    // Estimate by counting assignments, normalized to per-day
    const totalDaysWindow =
      stats.turnaroundMs.length > 0
        ? stats.turnaroundMs.reduce((a, b) => a + b, 0) / (1000 * 60 * 60 * 24)
        : 1;
    const decisionVelocity =
      totalDaysWindow > 0
        ? Math.round((stats.totalAssignments / totalDaysWindow) * 100) / 100
        : 0;

    const stallRate =
      stats.totalAssignments > 0
        ? Math.round((stats.stalledCount / stats.totalAssignments) * 100)
        : 0;

    const speedTier =
      stats.handoffLatencies.length > 0 ? computeSpeedTier(avgHandoffLatencyMs) : 'moderate';

    profiles.push({
      personaId,
      avgHandoffLatencyMs,
      avgSessionDurationMs,
      avgTurnaroundMs,
      decisionVelocity,
      stallRate,
      speedTier,
    });
  }

  // Sort by avgHandoffLatencyMs ascending (fastest first)
  profiles.sort((a, b) => a.avgHandoffLatencyMs - b.avgHandoffLatencyMs);
  return profiles;
}

export async function analyzeAgentDecisionSpeed(projectId: string): Promise<DecisionSpeedReport> {
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

  const agents = buildSpeedProfiles(allNotes, projectTickets);

  const systemAvgLatencyMs =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.avgHandoffLatencyMs, 0) / agents.length)
      : 0;

  const fastestAgent = agents.length > 0 ? agents[0].personaId : null;
  const slowestAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;

  const systemStallRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.stallRate, 0) / agents.length)
      : 0;

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
          `${a.personaId}: tier=${a.speedTier}, avgLatency=${a.avgHandoffLatencyMs}ms, stallRate=${a.stallRate}%, velocity=${a.decisionVelocity}`,
      )
      .join('\n');

    const prompt = `Analyze this agent decision speed data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall decision speed health\n- recommendations: array of 2-3 actionable recommendations (for slow/stalled agents)\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Decision speed AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    systemAvgLatencyMs,
    fastestAgent,
    slowestAgent,
    systemStallRate,
    aiSummary,
    aiRecommendations,
  };
}
