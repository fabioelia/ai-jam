import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentDependencyResolutionMetrics {
  agentId: string;
  agentName: string;
  totalDependencies: number;
  resolvedDependencies: number;
  avgResolutionTime: number;
  dependencyResolutionRate: number;
  resolutionScore: number; // 0-100
  resolutionTier: 'expert' | 'proficient' | 'developing' | 'struggling';
}

export interface AgentDependencyResolutionReport {
  projectId: string;
  agents: AgentDependencyResolutionMetrics[];
  totalDependencies: number;
  resolvedDependencies: number;
  dependencyResolutionRate: number;
  avgResolutionTimeHours: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Dependency resolution analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Focus on agents with low resolution rates to identify bottlenecks.',
  'Consider redistributing blocked tickets to agents with higher resolution scores.',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeResolutionTier(
  score: number,
): AgentDependencyResolutionMetrics['resolutionTier'] {
  if (score >= 80) return 'expert';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'developing';
  return 'struggling';
}

export function computeResolutionScore(
  resolutionRate: number,
  avgResolutionTimeHours: number,
): number {
  const bonus = avgResolutionTimeHours < 24 ? 10 : 0;
  return clamp(Math.round(resolutionRate * 0.6 + bonus), 0, 100);
}

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  blockedBy: string | null;
};

type SessionRow = {
  id: string;
  ticketId: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function buildDependencyResolutionMetrics(
  projectTickets: TicketRow[],
  allSessions: SessionRow[],
): AgentDependencyResolutionMetrics[] {
  // Group sessions by personaType
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  // Tickets with blockedBy set = "dependencies"
  const ticketMap = new Map<string, TicketRow>();
  for (const t of projectTickets) ticketMap.set(t.id, t);

  // Group blocked tickets by assignedPersona
  const blockedByPersona = new Map<string, TicketRow[]>();
  for (const t of projectTickets) {
    if (!t.blockedBy || !t.assignedPersona) continue;
    const list = blockedByPersona.get(t.assignedPersona) ?? [];
    list.push(t);
    blockedByPersona.set(t.assignedPersona, list);
  }

  // Compute per-agent metrics
  const allPersonas = new Set([
    ...sessionsByPersona.keys(),
    ...blockedByPersona.keys(),
  ]);

  const metrics: AgentDependencyResolutionMetrics[] = [];

  for (const personaId of allPersonas) {
    const blockedTickets = blockedByPersona.get(personaId) ?? [];
    const agentSessionList = sessionsByPersona.get(personaId) ?? [];

    const totalDependencies = blockedTickets.length;
    const resolvedTickets = blockedTickets.filter(
      (t) => t.status === 'done' || t.status === 'acceptance',
    );
    const resolvedDependencies = resolvedTickets.length;

    const dependencyResolutionRate =
      totalDependencies > 0
        ? Math.round((resolvedDependencies / totalDependencies) * 100)
        : 0;

    // avgResolutionTime: avg duration of completed sessions for this agent (hours)
    const completedSessions = agentSessionList.filter(
      (s) => s.status === 'completed' && s.startedAt && s.completedAt,
    );
    const avgResolutionTime =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => {
            const start = new Date(s.startedAt!).getTime();
            const end = new Date(s.completedAt!).getTime();
            return sum + (end - start) / (1000 * 60 * 60);
          }, 0) / completedSessions.length
        : 48; // default 48h if no completed sessions

    const resolutionScore = computeResolutionScore(
      dependencyResolutionRate,
      avgResolutionTime,
    );

    const agentName =
      personaId.charAt(0).toUpperCase() + personaId.slice(1).replace(/_/g, ' ');

    metrics.push({
      agentId: personaId,
      agentName,
      totalDependencies,
      resolvedDependencies,
      avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
      dependencyResolutionRate,
      resolutionScore,
      resolutionTier: computeResolutionTier(resolutionScore),
    });
  }

  metrics.sort((a, b) => b.resolutionScore - a.resolutionScore);
  return metrics;
}

export async function analyzeAgentDependencyResolution(
  projectId: string,
): Promise<AgentDependencyResolutionReport> {
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      blockedBy: tickets.blockedBy,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildDependencyResolutionMetrics(projectTickets, allSessions);

  const totalDependencies = projectTickets.filter(
    (t) => t.blockedBy != null && t.blockedBy !== '',
  ).length;
  const resolvedDependencies = projectTickets.filter(
    (t) =>
      (t.blockedBy != null && t.blockedBy !== '') &&
      (t.status === 'done' || t.status === 'acceptance'),
  ).length;
  const dependencyResolutionRate =
    totalDependencies > 0
      ? Math.round((resolvedDependencies / totalDependencies) * 100)
      : 0;

  const avgResolutionTimeHours =
    agents.length > 0
      ? Math.round(
          (agents.reduce((s, a) => s + a.avgResolutionTime, 0) / agents.length) * 10,
        ) / 10
      : 0;

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
          `${a.agentId}: score=${a.resolutionScore}, tier=${a.resolutionTier}, rate=${a.dependencyResolutionRate}%, deps=${a.totalDependencies}, resolved=${a.resolvedDependencies}, avgTime=${a.avgResolutionTime}h`,
      )
      .join('\n');

    const prompt = `Analyze the dependency resolution performance of AI agents:\n${agentSummaryText}\n\nProject: totalDeps=${totalDependencies}, resolved=${resolvedDependencies}, rate=${dependencyResolutionRate}%\n\nProvide:\n1. A summary paragraph about dependency resolution health\n2. 2-3 specific recommendations to improve resolution rates\n\nFormat as JSON: {"summary": "...", "recommendations": ["...", "..."]}`;

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
    console.warn('Dependency resolution AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    totalDependencies,
    resolvedDependencies,
    dependencyResolutionRate,
    avgResolutionTimeHours,
    aiSummary,
    aiRecommendations,
  };
}
