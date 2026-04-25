import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type DurationTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

export interface AgentSessionDurationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  durationScore: number;
  durationTier: DurationTier;
}

export interface SessionDurationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    efficientCount: number;
    slowCount: number;
    avgDurationMs: number;
    totalSessions: number;
  };
  agents: AgentSessionDurationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeDurationScore(
  totalSessions: number,
  avgDurationMs: number,
  p95DurationMs: number,
): number {
  const validSessions = totalSessions;
  if (validSessions < 2) return 0;
  const raw =
    validSessions * 4 +
    Math.max(0, 30 - avgDurationMs / 60000) * 1.5 +
    Math.max(0, 60 - p95DurationMs / 60000) * 0.5;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

export function getDurationTier(durationScore: number, validSessions: number): DurationTier {
  if (validSessions < 2) return 'insufficient_data';
  if (durationScore >= 70) return 'high';
  if (durationScore >= 35) return 'moderate';
  return 'low';
}

export function getDurationTierLabel(tier: DurationTier): string {
  switch (tier) {
    case 'high': return 'Efficient';
    case 'moderate': return 'Typical';
    case 'low': return 'Slow';
    default: return 'Insufficient Data';
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Full Stack Developer';
}

export async function analyzeAgentSessionDuration(projectId: string): Promise<SessionDurationReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  const agentMap = new Map<string, number[]>();

  for (const s of sessions) {
    if (s.startedAt == null || s.completedAt == null) continue;
    const durationMs = s.completedAt.getTime() - s.startedAt.getTime();
    if (durationMs <= 0) continue;
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push(durationMs);
  }

  const agents: AgentSessionDurationMetrics[] = [];

  for (const [name, durations] of agentMap.entries()) {
    const sorted = [...durations].sort((a, b) => a - b);
    const totalSessions = sorted.length;

    const avgDurationMs = totalSessions > 0
      ? Math.round(sorted.reduce((s, d) => s + d, 0) / totalSessions)
      : 0;

    let medianDurationMs = 0;
    if (totalSessions > 0) {
      const mid = Math.floor(totalSessions / 2);
      medianDurationMs = totalSessions % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
    }

    const p95DurationMs = totalSessions > 0
      ? sorted[Math.floor(totalSessions * 0.95)]
      : 0;

    const minDurationMs = totalSessions > 0 ? sorted[0] : 0;
    const maxDurationMs = totalSessions > 0 ? sorted[sorted.length - 1] : 0;

    const durationScore = computeDurationScore(totalSessions, avgDurationMs, p95DurationMs);
    const durationTier = getDurationTier(durationScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      avgDurationMs,
      medianDurationMs,
      p95DurationMs,
      minDurationMs,
      maxDurationMs,
      durationScore,
      durationTier,
    });
  }

  agents.sort((a, b) => b.durationScore - a.durationScore);

  const efficientCount = agents.filter((a) => a.durationTier === 'high').length;
  const slowCount = agents.filter((a) => a.durationTier === 'low').length;
  const totalSessions = agents.reduce((sum, a) => sum + a.totalSessions, 0);
  const avgDurationMs = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.avgDurationMs, 0) / agents.length)
    : 0;

  const aiSummary =
    `Session duration analysis complete for ${agents.length} agents. ` +
    `${efficientCount} agents are efficient, ${slowCount} are slow. ` +
    `Average session duration across all agents: ${formatDuration(avgDurationMs)}.`;

  const aiRecommendations = [
    'Review slow agents for unnecessary wait times or blocking operations.',
    'Set session duration targets to encourage focused, time-boxed work.',
    'Investigate high p95 durations — they indicate occasional very long sessions.',
    'Efficient agents can share session structuring patterns with slower peers.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      efficientCount,
      slowCount,
      avgDurationMs,
      totalSessions,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
