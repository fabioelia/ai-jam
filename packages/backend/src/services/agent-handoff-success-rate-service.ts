import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type ReliabilityTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

export interface AgentHandoffMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  completedSessions: number;
  stalledSessions: number;
  successRate: number;
  avgCompletionMs: number;
  reliabilityTier: ReliabilityTier;
}

export interface HandoffSuccessRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highSuccessCount: number;
    lowSuccessCount: number;
    avgSuccessRate: number;
    totalHandoffs: number;
  };
  agents: AgentHandoffMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSuccessRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 1000) / 1000;
}

export function getReliabilityTier(successRate: number, totalSessions: number): ReliabilityTier {
  if (totalSessions < 3) return 'insufficient_data';
  if (successRate >= 0.85) return 'high';
  if (successRate >= 0.6) return 'moderate';
  return 'low';
}

export function getReliabilityLabel(tier: ReliabilityTier): string {
  switch (tier) {
    case 'high':
      return 'Reliable';
    case 'moderate':
      return 'Inconsistent';
    case 'low':
      return 'Unreliable';
    default:
      return 'Insufficient Data';
  }
}

export function formatSuccessRate(rate: number): string {
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

const STALL_THRESHOLD_MS = 1800000; // 30 minutes

function isStalled(status: string, startedAt: Date | null, completedAt: Date | null): boolean {
  if (status === 'failed' || status === 'timeout') return true;
  if (status === 'running' && completedAt == null) {
    const durationMs = Date.now() - (startedAt?.getTime() ?? Date.now());
    return durationMs > STALL_THRESHOLD_MS;
  }
  return false;
}

export async function analyzeHandoffSuccessRate(projectId: string): Promise<HandoffSuccessRateReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group by agent
  const agentMap = new Map<
    string,
    Array<{ status: string; startedAt: Date | null; completedAt: Date | null }>
  >();

  for (const s of sessions) {
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    });
  }

  const agents: AgentHandoffMetrics[] = [];

  for (const [name, agentSessionList] of agentMap.entries()) {
    const totalSessions = agentSessionList.length;

    const completedList = agentSessionList.filter((s) => s.status === 'completed');
    const completedSessions = completedList.length;

    const stalledSessions = agentSessionList.filter((s) =>
      isStalled(s.status, s.startedAt, s.completedAt),
    ).length;

    const successRate = computeSuccessRate(completedSessions, totalSessions);

    // avgCompletionMs: average duration of completed sessions where both timestamps exist
    const completionDurations: number[] = [];
    for (const s of completedList) {
      if (s.startedAt != null && s.completedAt != null) {
        completionDurations.push(s.completedAt.getTime() - s.startedAt.getTime());
      }
    }
    const avgCompletionMs =
      completionDurations.length > 0
        ? Math.round(completionDurations.reduce((sum, d) => sum + d, 0) / completionDurations.length)
        : 0;

    const reliabilityTier = getReliabilityTier(successRate, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      completedSessions,
      stalledSessions,
      successRate,
      avgCompletionMs,
      reliabilityTier,
    });
  }

  agents.sort((a, b) => b.successRate - a.successRate);

  const highSuccessCount = agents.filter((a) => a.reliabilityTier === 'high').length;
  const lowSuccessCount = agents.filter((a) => a.reliabilityTier === 'low').length;
  const totalHandoffs = agents.reduce((sum, a) => sum + a.totalSessions, 0);
  const avgSuccessRate =
    agents.length > 0
      ? Math.round((agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) * 1000) / 1000
      : 0;

  const aiSummary =
    `Handoff success rate analysis complete for ${agents.length} agents across ${totalHandoffs} total sessions. ` +
    `${highSuccessCount} agents demonstrate high reliability (>=85% success rate), ` +
    `while ${lowSuccessCount} agents have low success rates requiring attention. ` +
    `Improving handoff protocols and reducing stalled sessions will raise overall project throughput.`;

  const aiRecommendations = [
    'Investigate root causes for stalled sessions and implement timeout recovery mechanisms.',
    'Provide additional context and clearer acceptance criteria to improve completion rates.',
    'Pair low-reliability agents with high-reliability agents for knowledge transfer.',
    'Set up automated alerts for sessions that exceed expected completion times.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highSuccessCount,
      lowSuccessCount,
      avgSuccessRate,
      totalHandoffs,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
