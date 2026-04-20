import { db } from '../db/connection.js';
import { agentSessions, tickets, ticketNotes } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentSessionDepthProfile {
  personaId: string;
  avgTicketsPerSession: number;
  avgHandoffsSentPerSession: number;
  avgHandoffsReceivedPerSession: number;
  avgSessionDurationHours: number;
  totalSessions: number;
  depthScore: number;
  depthCategory: 'deep' | 'moderate' | 'shallow' | 'pass-through';
}

export interface AgentSessionDepthReport {
  agents: AgentSessionDepthProfile[];
  avgDepthScore: number;
  deepestAgent: string | null;
  shallowestAgent: string | null;
  passThroughCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

type SessionRow = {
  personaType: string;
  ticketId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type NoteRow = {
  authorId: string;
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
};

function categorize(score: number): AgentSessionDepthProfile['depthCategory'] {
  if (score >= 70) return 'deep';
  if (score >= 45) return 'moderate';
  if (score >= 20) return 'shallow';
  return 'pass-through';
}

function calcDepthScore(
  avgTickets: number,
  avgSent: number,
  avgDuration: number,
  avgReceived: number,
  maxTickets: number,
  maxSent: number,
  maxDuration: number,
  maxReceived: number,
): number {
  const nT = maxTickets > 0 ? avgTickets / maxTickets : 0;
  const nS = maxSent > 0 ? avgSent / maxSent : 0;
  const nD = maxDuration > 0 ? avgDuration / maxDuration : 0;
  const nR = maxReceived > 0 ? avgReceived / maxReceived : 0;
  return Math.round((nT * 0.4 + nS * 0.3 + nD * 0.2 + nR * 0.1) * 100);
}

export function buildProfilesFromSessions(
  sessionRows: SessionRow[],
  noteRows: NoteRow[],
): AgentSessionDepthProfile[] {
  const agentMap = new Map<string, {
    sessions: SessionRow[];
    ticketIds: Set<string>;
    sentHandoffs: number;
    receivedHandoffs: number;
  }>();

  for (const row of sessionRows) {
    const p = row.personaType;
    if (!agentMap.has(p)) agentMap.set(p, { sessions: [], ticketIds: new Set(), sentHandoffs: 0, receivedHandoffs: 0 });
    const entry = agentMap.get(p)!;
    entry.sessions.push(row);
    if (row.ticketId) entry.ticketIds.add(row.ticketId);
  }

  for (const note of noteRows) {
    if (note.handoffFrom && agentMap.has(note.handoffFrom)) {
      agentMap.get(note.handoffFrom)!.sentHandoffs++;
    }
    if (note.handoffTo && agentMap.has(note.handoffTo)) {
      agentMap.get(note.handoffTo)!.receivedHandoffs++;
    }
  }

  const rawProfiles = Array.from(agentMap.entries()).map(([personaId, data]) => {
    const totalSessions = data.sessions.length;
    const avgTicketsPerSession = totalSessions > 0 ? data.ticketIds.size / totalSessions : 0;
    const avgHandoffsSentPerSession = totalSessions > 0 ? data.sentHandoffs / totalSessions : 0;
    const avgHandoffsReceivedPerSession = totalSessions > 0 ? data.receivedHandoffs / totalSessions : 0;

    let totalDurationHours = 0;
    let durationCount = 0;
    for (const s of data.sessions) {
      if (s.startedAt && s.completedAt) {
        totalDurationHours += (s.completedAt.getTime() - s.startedAt.getTime()) / 3_600_000;
        durationCount++;
      }
    }
    const avgSessionDurationHours = durationCount > 0 ? totalDurationHours / durationCount : 0;

    return { personaId, totalSessions, avgTicketsPerSession, avgHandoffsSentPerSession, avgHandoffsReceivedPerSession, avgSessionDurationHours };
  });

  const maxTickets = Math.max(0, ...rawProfiles.map(p => p.avgTicketsPerSession));
  const maxSent = Math.max(0, ...rawProfiles.map(p => p.avgHandoffsSentPerSession));
  const maxDuration = Math.max(0, ...rawProfiles.map(p => p.avgSessionDurationHours));
  const maxReceived = Math.max(0, ...rawProfiles.map(p => p.avgHandoffsReceivedPerSession));

  return rawProfiles.map(p => {
    const depthScore = calcDepthScore(
      p.avgTicketsPerSession, p.avgHandoffsSentPerSession, p.avgSessionDurationHours, p.avgHandoffsReceivedPerSession,
      maxTickets, maxSent, maxDuration, maxReceived,
    );
    return { ...p, depthScore, depthCategory: categorize(depthScore) };
  }).sort((a, b) => b.depthScore - a.depthScore);
}

export function buildFallbackProfiles(noteRows: NoteRow[]): AgentSessionDepthProfile[] {
  const agentMap = new Map<string, {
    ticketIds: Set<string>;
    sentHandoffs: number;
    receivedHandoffs: number;
  }>();

  for (const note of noteRows) {
    const a = note.authorId;
    if (!agentMap.has(a)) agentMap.set(a, { ticketIds: new Set(), sentHandoffs: 0, receivedHandoffs: 0 });
    const entry = agentMap.get(a)!;
    entry.ticketIds.add(note.ticketId);
    if (note.handoffFrom === a) entry.sentHandoffs++;
    if (note.handoffTo === a) entry.receivedHandoffs++;
  }

  const rawProfiles = Array.from(agentMap.entries()).map(([personaId, data]) => {
    const totalSessions = data.ticketIds.size;
    return {
      personaId,
      totalSessions,
      avgTicketsPerSession: 1,
      avgHandoffsSentPerSession: totalSessions > 0 ? data.sentHandoffs / totalSessions : 0,
      avgHandoffsReceivedPerSession: totalSessions > 0 ? data.receivedHandoffs / totalSessions : 0,
      avgSessionDurationHours: 0,
    };
  });

  const maxSent = Math.max(0, ...rawProfiles.map(p => p.avgHandoffsSentPerSession));
  const maxReceived = Math.max(0, ...rawProfiles.map(p => p.avgHandoffsReceivedPerSession));

  return rawProfiles.map(p => {
    const depthScore = calcDepthScore(
      p.avgTicketsPerSession, p.avgHandoffsSentPerSession, p.avgSessionDurationHours, p.avgHandoffsReceivedPerSession,
      1, maxSent, 0, maxReceived,
    );
    return { ...p, depthScore, depthCategory: categorize(depthScore) };
  }).sort((a, b) => b.depthScore - a.depthScore);
}

const EMPTY_REPORT: AgentSessionDepthReport = {
  agents: [],
  avgDepthScore: 0,
  deepestAgent: null,
  shallowestAgent: null,
  passThroughCount: 0,
  aiSummary: 'No session data available for this project.',
  aiRecommendations: ['Ensure agent sessions are tracked for accurate depth metrics.'],
};

export async function analyzeSessionDepth(projectId: string): Promise<AgentSessionDepthReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRows: SessionRow[] = await (db as any)
    .select({
      personaType: agentSessions.personaType,
      ticketId: agentSessions.ticketId,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId as unknown as typeof tickets.id, tickets.id))
    .where(and(eq(tickets.projectId, projectId), isNotNull(agentSessions.ticketId)));

  const noteRows: NoteRow[] = await db
    .select({
      authorId: ticketNotes.authorId,
      ticketId: ticketNotes.ticketId,
      handoffFrom: ticketNotes.handoffFrom,
      handoffTo: ticketNotes.handoffTo,
    })
    .from(ticketNotes)
    .innerJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  if (sessionRows.length === 0 && noteRows.length === 0) {
    return EMPTY_REPORT;
  }

  const agents = sessionRows.length > 0
    ? buildProfilesFromSessions(sessionRows, noteRows)
    : buildFallbackProfiles(noteRows);

  if (agents.length === 0) return EMPTY_REPORT;

  const avgDepthScore = Math.round(agents.reduce((s, a) => s + a.depthScore, 0) / agents.length);
  const deepestAgent = agents[0].personaId;
  const shallowestAgent = agents[agents.length - 1].personaId;
  const passThroughCount = agents.filter(a => a.depthCategory === 'pass-through').length;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = `Average session depth score: ${avgDepthScore}/100. ${passThroughCount} agent(s) classified as pass-through.`;
  let aiRecommendations: string[] = ['Review pass-through agents to increase session depth and engagement.'];

  try {
    const agentLines = agents.slice(0, 5).map(a =>
      `${a.personaId}: score=${a.depthScore}, category=${a.depthCategory}, tickets/session=${a.avgTicketsPerSession.toFixed(2)}, handoffs-sent/session=${a.avgHandoffsSentPerSession.toFixed(2)}, duration=${a.avgSessionDurationHours.toFixed(2)}h`
    ).join('\n');
    const prompt = `Analyze agent session depth. Top agents:\n${agentLines}\n\nAvg depth: ${avgDepthScore}/100. Pass-through: ${passThroughCount}. Respond with JSON only: {"summary": "2-3 sentence summary", "recommendations": ["rec1", "rec2", "rec3"]}`;
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = text;
      }
    }
  } catch (e) {
    console.warn('Session depth AI summary failed, using fallback:', e);
  }

  return { agents, avgDepthScore, deepestAgent, shallowestAgent, passThroughCount, aiSummary, aiRecommendations };
}
