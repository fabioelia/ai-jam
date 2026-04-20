import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentDeadlineData {
  personaId: string;
  totalTasksWithDeadline: number;
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  avgDelayMinutes: number;
  maxDelayMinutes: number;
  adherenceRate: number;
  slaBreachRate: number;
  adherenceLevel: 'excellent' | 'good' | 'fair' | 'poor';
  delayTrend: 'improving' | 'stable' | 'degrading';
}

export interface AgentDeadlineAdherenceReport {
  projectId: string;
  generatedAt: Date;
  agents: AgentDeadlineData[];
  systemAdherenceRate: number;
  mostReliableAgent: string;
  leastReliableAgent: string;
  avgSystemDelay: number;
  totalSlsBreaches: number;
  summary: string;
  recommendations: string[];
}

export const FALLBACK_SUMMARY = 'Deadline adherence analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Investigate chronic deadline misses to identify systemic blockers.',
  'Set realistic time estimates for complex tasks.',
];

export function computeAdherenceLevel(adherenceRate: number): AgentDeadlineData['adherenceLevel'] {
  if (adherenceRate >= 85) return 'excellent';
  if (adherenceRate >= 70) return 'good';
  if (adherenceRate >= 50) return 'fair';
  return 'poor';
}

export function computeDelayTrend(delays: number[]): AgentDeadlineData['delayTrend'] {
  if (delays.length < 10) return 'stable';
  const recent = delays.slice(-5);
  const previous = delays.slice(-10, -5);
  const recentAvg = recent.reduce((s, d) => s + d, 0) / recent.length;
  const prevAvg = previous.reduce((s, d) => s + d, 0) / previous.length;
  if (prevAvg === 0) return 'stable';
  const delta = (recentAvg - prevAvg) / prevAvg;
  if (delta < -0.1) return 'improving';
  if (delta > 0.1) return 'degrading';
  return 'stable';
}

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: string;
};

export function buildDeadlineProfiles(
  sessions: SessionRow[],
  ticketRows: TicketRow[],
): AgentDeadlineData[] {
  // Build expected durations from ticket lifecycle
  const ticketMap = new Map<string, TicketRow>();
  for (const t of ticketRows) ticketMap.set(t.id, t);

  // Group sessions by personaType
  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  // Gather unique agents from ticket assignees too
  const agentSet = new Set<string>();
  for (const s of sessions) agentSet.add(s.personaType);
  for (const t of ticketRows) if (t.assignedPersona) agentSet.add(t.assignedPersona);

  const profiles: AgentDeadlineData[] = [];

  for (const personaId of agentSet) {
    const agentSessions = sessionsByAgent.get(personaId) ?? [];

    // Estimate expected duration as median ticket lifecycle for that agent (or default 2h)
    const defaultExpectedMs = 2 * 60 * 60 * 1000; // 2 hours

    const delays: number[] = [];
    let onTimeCount = 0;
    let lateCount = 0;
    let missedCount = 0;

    for (const session of agentSessions) {
      if (!session.startedAt) continue;

      const startTime = new Date(session.startedAt).getTime();
      const expectedEnd = startTime + defaultExpectedMs;

      if (session.status === 'completed' && session.completedAt) {
        const completedTime = new Date(session.completedAt).getTime();
        if (completedTime <= expectedEnd) {
          onTimeCount++;
        } else {
          lateCount++;
          delays.push((completedTime - expectedEnd) / 60000); // minutes
        }
      } else if (session.status === 'failed') {
        missedCount++;
      }
    }

    const totalTasksWithDeadline = onTimeCount + lateCount + missedCount;
    const avgDelayMinutes = delays.length > 0 ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length) : 0;
    const maxDelayMinutes = delays.length > 0 ? Math.round(Math.max(...delays)) : 0;
    const adherenceRate = totalTasksWithDeadline > 0
      ? Math.round((onTimeCount / totalTasksWithDeadline) * 100)
      : 100;
    const slaBreachRate = totalTasksWithDeadline > 0
      ? Math.round(((lateCount + missedCount) / totalTasksWithDeadline) * 100)
      : 0;

    profiles.push({
      personaId,
      totalTasksWithDeadline,
      onTimeCount,
      lateCount,
      missedCount,
      avgDelayMinutes,
      maxDelayMinutes,
      adherenceRate,
      slaBreachRate,
      adherenceLevel: computeAdherenceLevel(adherenceRate),
      delayTrend: computeDelayTrend(delays),
    });
  }

  profiles.sort((a, b) => b.adherenceRate - a.adherenceRate);
  return profiles;
}

export async function analyzeAgentDeadlineAdherence(projectId: string): Promise<AgentDeadlineAdherenceReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
        createdAt: agentSessions.createdAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildDeadlineProfiles(allSessions, projectTickets);

  const systemAdherenceRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.adherenceRate, 0) / agents.length)
    : 100;

  const mostReliableAgent = agents.length > 0 ? agents[0].personaId : '';
  const leastReliableAgent = agents.length > 1 ? agents[agents.length - 1].personaId : mostReliableAgent;

  const allDelays = agents.flatMap((a) => {
    const perTask = a.lateCount > 0 ? a.avgDelayMinutes : 0;
    return Array(a.lateCount).fill(perTask);
  });
  const avgSystemDelay = allDelays.length > 0
    ? Math.round(allDelays.reduce((s, d) => s + d, 0) / allDelays.length)
    : 0;

  const totalSlsBreaches = agents.reduce((s, a) => s + a.lateCount + a.missedCount, 0);

  let summary = FALLBACK_SUMMARY;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentSummaryText = agents
      .map(
        (a) =>
          `${a.personaId}: adherence=${a.adherenceRate}%, level=${a.adherenceLevel}, late=${a.lateCount}, missed=${a.missedCount}`,
      )
      .join('\n');

    const prompt = `Analyze this agent deadline adherence data:\n${agentSummaryText}\n\nReturn JSON with:\n- summary: 1-2 sentence insight\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) summary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          recommendations = parsed.recommendations;
        }
      } catch {
        summary = raw;
      }
    }
  } catch (e) {
    console.warn('Deadline adherence AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date(),
    agents,
    systemAdherenceRate,
    mostReliableAgent,
    leastReliableAgent,
    avgSystemDelay,
    totalSlsBreaches,
    summary,
    recommendations,
  };
}
