import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentThroughputData {
  personaId: string;
  totalSessions: number;
  ticketsClosed: number;
  ticketsPerSession: number;
  ticketsPerDay: number;
  peakDay: string | null;
  throughputTier: 'high' | 'moderate' | 'low' | 'idle';
}

export interface AgentThroughputRateReport {
  projectId: string;
  agents: AgentThroughputData[];
  highestThroughputAgent: string | null;
  idleAgents: number;
  avgTicketsPerDay: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Throughput rate analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Focus on reducing idle time for agents with low throughput.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
};

export type SessionRow = {
  ticketId: string | null;
  personaType: string;
  startedAt: Date | null;
};

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeThroughputTier(ticketsPerDay: number): AgentThroughputData['throughputTier'] {
  if (ticketsPerDay >= 3) return 'high';
  if (ticketsPerDay >= 1) return 'moderate';
  if (ticketsPerDay > 0) return 'low';
  return 'idle';
}

export function buildThroughputProfiles(
  ticketRows: TicketRow[],
  sessionRows: SessionRow[],
): AgentThroughputData[] {
  const agentSet = new Set<string>();
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }
  for (const s of sessionRows) {
    agentSet.add(s.personaType);
  }

  const profiles: AgentThroughputData[] = [];

  for (const personaId of agentSet) {
    const agentSess = sessionRows.filter((s) => s.personaType === personaId);
    const totalSessions = agentSess.length;

    const doneTickets = ticketRows.filter(
      (t) => t.assignedPersona === personaId && t.status === 'done',
    );
    const ticketsClosed = doneTickets.length;

    const ticketsPerSession = ticketsClosed / Math.max(totalSessions, 1);

    // distinct calendar days from startedAt
    const daySet = new Set<string>();
    for (const s of agentSess) {
      if (s.startedAt) daySet.add(dateString(s.startedAt));
    }
    const activeDays = daySet.size;
    const ticketsPerDay = ticketsClosed / Math.max(activeDays, 1);

    // peakDay: day with most sessions
    const dayCount = new Map<string, number>();
    for (const s of agentSess) {
      if (s.startedAt) {
        const day = dateString(s.startedAt);
        dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
      }
    }
    let peakDay: string | null = null;
    if (dayCount.size > 0) {
      let maxCount = 0;
      for (const [day, count] of dayCount.entries()) {
        if (count > maxCount) { maxCount = count; peakDay = day; }
      }
    }

    profiles.push({
      personaId,
      totalSessions,
      ticketsClosed,
      ticketsPerSession: Math.round(ticketsPerSession * 100) / 100,
      ticketsPerDay: Math.round(ticketsPerDay * 100) / 100,
      peakDay,
      throughputTier: computeThroughputTier(ticketsPerDay),
    });
  }

  profiles.sort((a, b) => b.ticketsPerDay - a.ticketsPerDay);
  return profiles;
}

export async function analyzeAgentThroughputRate(
  projectId: string,
): Promise<AgentThroughputRateReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        startedAt: agentSessions.startedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildThroughputProfiles(projectTickets, allSessions);

  const nonIdle = agents.filter((a) => a.ticketsPerDay > 0);
  const highestThroughputAgent = nonIdle.length > 0 ? nonIdle[0].personaId : null;
  const idleAgents = agents.filter((a) => a.ticketsPerDay === 0).length;

  const avgTicketsPerDay =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.ticketsPerDay, 0) / agents.length) * 100) / 100
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
          `${a.personaId}: tier=${a.throughputTier}, closed=${a.ticketsClosed}, perDay=${a.ticketsPerDay}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent throughput rate data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall throughput health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Throughput rate AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    highestThroughputAgent,
    idleAgents,
    avgTicketsPerDay,
    aiSummary,
    aiRecommendations,
  };
}
