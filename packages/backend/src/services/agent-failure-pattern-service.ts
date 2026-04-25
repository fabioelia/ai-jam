import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type HealthTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

export interface AgentFailurePatternMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  failedSessions: number;
  timedOutSessions: number;
  failureRate: number;
  timeoutRate: number;
  maxConsecutiveFailures: number;
  lastFailedAt: Date | null;
  healthScore: number;
  healthTier: HealthTier;
}

export interface FailurePatternReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    criticalCount: number;
    healthyCount: number;
    avgFailureRate: number;
    totalFailedSessions: number;
  };
  agents: AgentFailurePatternMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeHealthScore(
  totalSessions: number,
  failureRate: number,
  maxConsecutiveFailures: number,
): number {
  if (totalSessions < 3) return 0;
  return Math.round(
    Math.min(100, Math.max(0, 100 - failureRate * 60 - maxConsecutiveFailures * 8)) * 10,
  ) / 10;
}

export function getHealthTier(healthScore: number, totalSessions: number): HealthTier {
  if (totalSessions < 3) return 'insufficient_data';
  if (healthScore >= 80) return 'high';
  if (healthScore >= 50) return 'moderate';
  return 'low';
}

export function getHealthTierLabel(tier: HealthTier): string {
  switch (tier) {
    case 'high': return 'Healthy';
    case 'moderate': return 'Degraded';
    case 'low': return 'Failing';
    default: return 'Insufficient Data';
  }
}

export function formatFailureRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
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

export async function analyzeAgentFailurePatterns(projectId: string): Promise<FailurePatternReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      startedAt: agentSessions.startedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  type SessionRow = { status: string | null; startedAt: Date | null };
  const agentMap = new Map<string, SessionRow[]>();

  for (const s of sessions) {
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: s.status, startedAt: s.startedAt });
  }

  const agents: AgentFailurePatternMetrics[] = [];

  for (const [name, agentSessionList] of agentMap.entries()) {
    agentSessionList.sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
    const totalSessions = agentSessionList.length;

    const failedSessions = agentSessionList.filter((s) => s.status === 'failed').length;
    const timedOutSessions = agentSessionList.filter((s) => s.status === 'timeout').length;

    const failureRate = totalSessions > 0
      ? Math.round(((failedSessions + timedOutSessions) / totalSessions) * 1000) / 1000
      : 0;
    const timeoutRate = totalSessions > 0
      ? Math.round((timedOutSessions / totalSessions) * 1000) / 1000
      : 0;

    let maxConsecutiveFailures = 0;
    let currentStreak = 0;
    for (const s of agentSessionList) {
      if (s.status === 'failed' || s.status === 'timeout') {
        currentStreak++;
        if (currentStreak > maxConsecutiveFailures) maxConsecutiveFailures = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    const failedSorted = agentSessionList
      .filter((s) => (s.status === 'failed' || s.status === 'timeout') && s.startedAt != null)
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
    const lastFailedAt = failedSorted.length > 0 ? failedSorted[0].startedAt : null;

    const healthScore = computeHealthScore(totalSessions, failureRate, maxConsecutiveFailures);
    const healthTier = getHealthTier(healthScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      failedSessions,
      timedOutSessions,
      failureRate,
      timeoutRate,
      maxConsecutiveFailures,
      lastFailedAt,
      healthScore,
      healthTier,
    });
  }

  agents.sort((a, b) => a.healthScore - b.healthScore);

  const criticalCount = agents.filter((a) => a.healthTier === 'low').length;
  const healthyCount = agents.filter((a) => a.healthTier === 'high').length;
  const totalFailedSessions = agents.reduce((sum, a) => sum + a.failedSessions + a.timedOutSessions, 0);
  const avgFailureRate = agents.length > 0
    ? Math.round((agents.reduce((sum, a) => sum + a.failureRate, 0) / agents.length) * 1000) / 1000
    : 0;

  const aiSummary =
    `Failure pattern analysis complete for ${agents.length} agents. ` +
    `${criticalCount} agents are in a failing state, ${healthyCount} are healthy. ` +
    `Total failed/timed-out sessions: ${totalFailedSessions}.`;

  const aiRecommendations = [
    'Investigate agents with high consecutive failure streaks — they may be stuck on a blocker.',
    'Review timeout thresholds to distinguish slow agents from truly failed ones.',
    'Add retry logic for agents with high timeout rates but low failure rates.',
    'Healthy agents can mentor or pair with failing agents to reduce error rates.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      criticalCount,
      healthyCount,
      avgFailureRate,
      totalFailedSessions,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
