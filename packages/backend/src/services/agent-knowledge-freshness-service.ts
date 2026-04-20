import { db } from '../db/connection.js';
import { tickets, ticketNotes, agentSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentFreshnessProfile {
  personaId: string;
  avgHandoffAgeHours: number;
  staleHandoffCount: number;
  freshHandoffCount: number;
  avgTicketUpdateLagHours: number;
  freshnessScore: number; // 0-100
  freshnessCategory: 'excellent' | 'good' | 'fair' | 'stale';
}

export interface KnowledgeFreshnessReport {
  agents: AgentFreshnessProfile[];
  avgFreshnessScore: number;
  freshestAgent: string;
  staleestAgent: string;
  systemStaleHandoffRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Knowledge freshness analysis complete. Review agent handoff patterns to improve responsiveness.';
export const FALLBACK_RECOMMENDATIONS = [
  'Reduce handoff response lag by setting up notifications for new assignments.',
  'Aim for agents to start sessions within 1 hour of receiving a handoff.',
];

export function computeFreshnessScore(
  freshHandoffCount: number,
  staleHandoffCount: number,
  avgTicketUpdateLagHours: number,
): number {
  const total = freshHandoffCount + staleHandoffCount;
  const freshHandoffRate = freshHandoffCount / Math.max(total, 1);
  const staleHandoffRate = staleHandoffCount / Math.max(total, 1);
  const lagPenalty = Math.max(0, 1 - avgTicketUpdateLagHours / 48);
  const score = freshHandoffRate * 50 + (1 - staleHandoffRate) * 30 + lagPenalty * 20;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function computeFreshnessCategory(score: number): AgentFreshnessProfile['freshnessCategory'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'stale';
}

function extractJSON(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return text;
}

type HandoffRow = {
  id: string;
  ticketId: string;
  handoffTo: string | null;
  createdAt: Date;
};

type SessionRow = {
  id: string;
  personaType: string;
  ticketId: string | null;
  startedAt: Date | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  updatedAt: Date;
};

export function buildFreshnessProfiles(
  handoffs: HandoffRow[],
  sessions: SessionRow[],
  ticketRows: TicketRow[],
): AgentFreshnessProfile[] {
  // Build map of tickets for quick lookup
  const ticketMap = new Map<string, TicketRow>();
  for (const t of ticketRows) {
    ticketMap.set(t.id, t);
  }

  // Collect all agents that are targets of handoffs
  const agentSet = new Set<string>();
  for (const h of handoffs) {
    if (h.handoffTo) agentSet.add(h.handoffTo);
  }
  // Also include agents with sessions
  for (const s of sessions) {
    if (s.personaType) agentSet.add(s.personaType);
  }

  // Build session lists per persona, sorted by createdAt
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }
  for (const list of sessionsByPersona.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Build handoffs per target agent
  const handoffsByAgent = new Map<string, HandoffRow[]>();
  for (const h of handoffs) {
    if (!h.handoffTo) continue;
    const list = handoffsByAgent.get(h.handoffTo) ?? [];
    list.push(h);
    handoffsByAgent.set(h.handoffTo, list);
  }

  const profiles: AgentFreshnessProfile[] = [];

  for (const personaId of agentSet) {
    const agentHandoffs = handoffsByAgent.get(personaId) ?? [];
    const agentSessions = sessionsByPersona.get(personaId) ?? [];

    let staleHandoffCount = 0;
    let freshHandoffCount = 0;
    const handoffAges: number[] = [];

    for (const h of agentHandoffs) {
      const handoffTime = h.createdAt.getTime();
      // Find the agent's first session that started AFTER this handoff
      const nextSession = agentSessions.find(
        (s) => (s.startedAt ?? s.createdAt).getTime() > handoffTime,
      );

      if (nextSession) {
        const sessionTime = (nextSession.startedAt ?? nextSession.createdAt).getTime();
        const lagHours = (sessionTime - handoffTime) / (1000 * 60 * 60);
        handoffAges.push(lagHours);

        if (lagHours > 24) {
          staleHandoffCount++;
        } else if (lagHours < 1) {
          freshHandoffCount++;
        }
      } else {
        // No session after this handoff - treat as stale
        staleHandoffCount++;
        handoffAges.push(48); // assume 48h lag as worst case
      }
    }

    const avgHandoffAgeHours =
      handoffAges.length > 0
        ? handoffAges.reduce((a, b) => a + b, 0) / handoffAges.length
        : 0;

    // avgTicketUpdateLagHours: avg hours between ticket.updatedAt and agent's subsequent session
    const updateLags: number[] = [];
    for (const s of agentSessions) {
      const sessionStart = (s.startedAt ?? s.createdAt).getTime();
      if (s.ticketId) {
        const ticket = ticketMap.get(s.ticketId);
        if (ticket) {
          const ticketUpdateTime = ticket.updatedAt.getTime();
          // Lag = session start - ticket last update (if positive)
          const lagMs = sessionStart - ticketUpdateTime;
          if (lagMs > 0) {
            updateLags.push(lagMs / (1000 * 60 * 60));
          }
        }
      }
    }

    const avgTicketUpdateLagHours =
      updateLags.length > 0
        ? updateLags.reduce((a, b) => a + b, 0) / updateLags.length
        : 0;

    const freshnessScore = computeFreshnessScore(freshHandoffCount, staleHandoffCount, avgTicketUpdateLagHours);
    const freshnessCategory = computeFreshnessCategory(freshnessScore);

    profiles.push({
      personaId,
      avgHandoffAgeHours: Math.round(avgHandoffAgeHours * 100) / 100,
      staleHandoffCount,
      freshHandoffCount,
      avgTicketUpdateLagHours: Math.round(avgTicketUpdateLagHours * 100) / 100,
      freshnessScore,
      freshnessCategory,
    });
  }

  return profiles;
}

export async function analyzeKnowledgeFreshness(projectId: string): Promise<KnowledgeFreshnessReport> {
  // Fetch all tickets for this project
  const ticketRows = await db
    .select({
      id: tickets.id,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = ticketRows.map((t) => t.id);

  // Fetch handoff notes (ticketNotes with handoffTo set)
  let handoffs: HandoffRow[] = [];
  if (ticketIds.length > 0) {
    const { inArray } = await import('drizzle-orm');
    const allNotes = await db
      .select({
        id: ticketNotes.id,
        ticketId: ticketNotes.ticketId,
        handoffTo: ticketNotes.handoffTo,
        createdAt: ticketNotes.createdAt,
      })
      .from(ticketNotes)
      .where(inArray(ticketNotes.ticketId, ticketIds));

    handoffs = allNotes.filter((n) => n.handoffTo != null);
  }

  // Fetch agent sessions for this project's tickets
  let sessions: SessionRow[] = [];
  if (ticketIds.length > 0) {
    const { inArray } = await import('drizzle-orm');
    const rawSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        ticketId: agentSessions.ticketId,
        startedAt: agentSessions.startedAt,
        createdAt: agentSessions.createdAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));

    sessions = rawSessions;
  }

  const profiles = buildFreshnessProfiles(handoffs, sessions, ticketRows);

  if (profiles.length === 0) {
    return {
      agents: [],
      avgFreshnessScore: 0,
      freshestAgent: '',
      staleestAgent: '',
      systemStaleHandoffRate: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const avgFreshnessScore =
    Math.round((profiles.reduce((sum, p) => sum + p.freshnessScore, 0) / profiles.length) * 100) / 100;

  const sorted = [...profiles].sort((a, b) => b.freshnessScore - a.freshnessScore);
  const freshestAgent = sorted[0].personaId;
  const staleestAgent = sorted[sorted.length - 1].personaId;

  const totalStale = profiles.reduce((sum, p) => sum + p.staleHandoffCount, 0);
  const totalHandoffs = profiles.reduce((sum, p) => sum + p.staleHandoffCount + p.freshHandoffCount, 0);
  const systemStaleHandoffRate =
    totalHandoffs > 0 ? Math.round((totalStale / totalHandoffs) * 10000) / 10000 : 0;

  // AI summary via OpenRouter
  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = profiles.map(
      (p) =>
        `${p.personaId}: score=${p.freshnessScore} (${p.freshnessCategory}), stale=${p.staleHandoffCount}, fresh=${p.freshHandoffCount}, avgLag=${p.avgTicketUpdateLagHours}h`,
    );

    const prompt = `You are an AI analyzing knowledge freshness for AI agents in a software project.

Agent freshness data:
${summaryLines.join('\n')}

System stale handoff rate: ${(systemStaleHandoffRate * 100).toFixed(1)}%
Average freshness score: ${avgFreshnessScore}/100

Respond with a JSON object (no markdown fences) with exactly these fields:
{
  "aiSummary": "2-3 sentence summary of agent knowledge freshness across the system",
  "aiRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`;

    const response = await client.messages.create({
      model: 'qwen/qwen3-6b',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(extractJSON(text));
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
    if (Array.isArray(parsed.aiRecommendations)) aiRecommendations = parsed.aiRecommendations;
  } catch {
    // fallback already set
  }

  return {
    agents: profiles,
    avgFreshnessScore,
    freshestAgent,
    staleestAgent,
    systemStaleHandoffRate,
    aiSummary,
    aiRecommendations,
  };
}
