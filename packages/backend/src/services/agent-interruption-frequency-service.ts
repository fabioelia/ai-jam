import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type InterruptionTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

export interface AgentInterruptionMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  interruptedSessions: number;
  interruptionsPerSession: number;
  avgInterruptedSessionMs: number;
  focusRatio: number;
  interruptionScore: number;
  interruptionTier: InterruptionTier;
}

export interface InterruptionFrequencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highInterruptionCount: number;
    lowInterruptionCount: number;
    avgInterruptionsPerSession: number;
    totalInterruptions: number;
  };
  agents: AgentInterruptionMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

const SHORT_SESSION_MS = 900000; // 15 min
const FOLLOWUP_WINDOW_MS = 3600000; // 1 hour

export function computeInterruptionScore(
  interruptionsPerSession: number,
  avgInterruptedSessionMs: number,
  totalSessions: number,
): number {
  const shortPenalty =
    totalSessions > 0 ? Math.max(0, 15 - avgInterruptedSessionMs / 60000) * 2 : 0;
  const raw = interruptionsPerSession * 60 + shortPenalty;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

export function getInterruptionTier(interruptionScore: number, totalSessions: number): InterruptionTier {
  if (totalSessions < 3) return 'insufficient_data';
  if (interruptionScore >= 60) return 'high';
  if (interruptionScore >= 25) return 'moderate';
  return 'low';
}

export function getInterruptionTierLabel(tier: InterruptionTier): string {
  switch (tier) {
    case 'high': return 'Highly Interrupted';
    case 'moderate': return 'Occasionally Interrupted';
    case 'low': return 'Focused';
    default: return 'Insufficient Data';
  }
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

export async function analyzeInterruptionFrequency(projectId: string): Promise<InterruptionFrequencyReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  type SessionRow = { startedAt: Date | null; completedAt: Date | null };
  const agentMap = new Map<string, SessionRow[]>();

  for (const s of sessions) {
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    });
  }

  const agents: AgentInterruptionMetrics[] = [];

  for (const [name, agentSessionList] of agentMap.entries()) {
    agentSessionList.sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
    const totalSessions = agentSessionList.length;

    const interruptedDurations: number[] = [];
    let interruptedSessions = 0;

    for (let i = 0; i < agentSessionList.length; i++) {
      const s = agentSessionList[i];
      if (s.startedAt == null || s.completedAt == null) continue;

      const duration = s.completedAt.getTime() - s.startedAt.getTime();
      if (duration >= SHORT_SESSION_MS) continue;

      const endedAt = s.completedAt.getTime();

      // Check if next session starts within 1h after this session ended
      const next = agentSessionList[i + 1];
      if (next?.startedAt != null && next.startedAt.getTime() < endedAt + FOLLOWUP_WINDOW_MS) {
        interruptedSessions++;
        interruptedDurations.push(duration);
      }
    }

    const interruptionsPerSession =
      totalSessions > 0 ? Math.round((interruptedSessions / totalSessions) * 1000) / 1000 : 0;

    const avgInterruptedSessionMs =
      interruptedDurations.length > 0
        ? Math.round(interruptedDurations.reduce((sum, d) => sum + d, 0) / interruptedDurations.length)
        : 0;

    const focusRatio = Math.round(Math.max(0, Math.min(1, 1 - interruptionsPerSession)) * 1000) / 1000;

    const interruptionScore =
      totalSessions < 3 ? 0 : computeInterruptionScore(interruptionsPerSession, avgInterruptedSessionMs, totalSessions);

    const interruptionTier = getInterruptionTier(interruptionScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      interruptedSessions,
      interruptionsPerSession,
      avgInterruptedSessionMs,
      focusRatio,
      interruptionScore,
      interruptionTier,
    });
  }

  agents.sort((a, b) => b.interruptionScore - a.interruptionScore);

  const highInterruptionCount = agents.filter((a) => a.interruptionTier === 'high').length;
  const lowInterruptionCount = agents.filter((a) => a.interruptionTier === 'low').length;
  const totalInterruptions = agents.reduce((sum, a) => sum + a.interruptedSessions, 0);
  const avgInterruptionsPerSession =
    agents.length > 0
      ? Math.round((agents.reduce((sum, a) => sum + a.interruptionsPerSession, 0) / agents.length) * 1000) / 1000
      : 0;

  const aiSummary =
    `Interruption frequency analysis complete for ${agents.length} agents. ` +
    `${highInterruptionCount} agents are highly interrupted, impacting focus and throughput. ` +
    `${lowInterruptionCount} agents maintain strong focus ratios. ` +
    `Total interruptions detected: ${totalInterruptions}.`;

  const aiRecommendations = [
    'Schedule dedicated focus blocks for highly interrupted agents to reduce context-switching overhead.',
    'Review session handoff protocols to ensure agents complete meaningful work before transitioning.',
    'Investigate why short sessions are being followed immediately by new sessions — batch smaller tasks.',
    'Set a minimum session length policy to reduce fragmented work patterns.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highInterruptionCount,
      lowInterruptionCount,
      avgInterruptionsPerSession,
      totalInterruptions,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
