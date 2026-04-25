import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';

export type PeakWindow = 'morning' | 'afternoon' | 'evening' | 'night';

export interface WindowStats {
  window: PeakWindow;
  sessionCount: number;
  completionRate: number;
  avgSpeedScore: number;
  score: number;
}

export interface AgentPeakMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  windows: WindowStats[];
  peakWindow: PeakWindow | 'insufficient_data';
  peakScore: number;
  consistency: number;
}

export interface AgentPeakPerformanceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    agentsWithPeak: number;
    mostCommonPeakWindow: string;
    avgPeakScore: number;
  };
  agents: AgentPeakMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function classifyWindow(hour: number): PeakWindow {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'night';
}

export function computeWindowScore(
  completionRate: number,
  avgSpeedScore: number,
  sessionCount: number,
): number {
  const completionComponent = completionRate * 60;
  const speedComponent = avgSpeedScore * 30;
  const volumeBonus = Math.min(sessionCount / 10, 1) * 10;
  return Math.round(Math.min(100, Math.max(0, completionComponent + speedComponent + volumeBonus)));
}

export function getPeakLabel(window: PeakWindow | 'insufficient_data'): string {
  switch (window) {
    case 'morning': return '🌅 Morning';
    case 'afternoon': return '☀️ Afternoon';
    case 'evening': return '🌆 Evening';
    case 'night': return '🌙 Night';
    default: return 'N/A';
  }
}

export function getConsistencyTier(consistency: number): 'consistent' | 'moderate' | 'variable' {
  if (consistency >= 75) return 'consistent';
  if (consistency >= 50) return 'moderate';
  return 'variable';
}

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  updatedAt: Date | null;
  createdAt: Date | null;
};

export async function analyzeAgentPeakPerformance(
  projectId: string,
): Promise<AgentPeakPerformanceReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      updatedAt: tickets.updatedAt,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
      ),
    );

  const personaMap = new Map<string, TicketRow[]>();
  for (const t of allTickets) {
    if (!t.assignedPersona) continue;
    const key = t.assignedPersona;
    if (!personaMap.has(key)) personaMap.set(key, []);
    personaMap.get(key)!.push(t);
  }

  const ALL_WINDOWS: PeakWindow[] = ['morning', 'afternoon', 'evening', 'night'];

  const agents: AgentPeakMetrics[] = [];
  let agentIdx = 0;

  for (const [persona, agentTickets] of personaMap.entries()) {
    agentIdx++;
    const totalSessions = agentTickets.length;

    if (totalSessions < 3) {
      agents.push({
        agentId: `agent-${agentIdx}`,
        agentName: persona,
        agentRole: persona,
        totalSessions,
        windows: [],
        peakWindow: 'insufficient_data',
        peakScore: 0,
        consistency: 0,
      });
      continue;
    }

    const windowBuckets = new Map<PeakWindow, TicketRow[]>();
    for (const w of ALL_WINDOWS) windowBuckets.set(w, []);

    for (const t of agentTickets) {
      const date = t.updatedAt ? new Date(t.updatedAt) : new Date();
      const hour = date.getHours();
      const w = classifyWindow(hour);
      windowBuckets.get(w)!.push(t);
    }

    const windowStats: WindowStats[] = ALL_WINDOWS.map((w) => {
      const bucket = windowBuckets.get(w)!;
      const sessionCount = bucket.length;
      if (sessionCount === 0) {
        return { window: w, sessionCount: 0, completionRate: 0, avgSpeedScore: 0, score: 0 };
      }

      const done = bucket.filter((t) => t.status === 'done');
      const completionRate = done.length / sessionCount;

      const speeds: number[] = [];
      for (const t of done) {
        if (t.createdAt && t.updatedAt) {
          const daysToComplete =
            (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          const speedScore = Math.min(100, Math.max(0, (1 - daysToComplete / 30) * 100));
          speeds.push(speedScore);
        }
      }
      const avgSpeedScore = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const score = computeWindowScore(completionRate, avgSpeedScore, sessionCount);

      return { window: w, sessionCount, completionRate, avgSpeedScore, score };
    });

    const nonEmptyWindows = windowStats.filter((ws) => ws.sessionCount > 0);
    let peakWindow: PeakWindow | 'insufficient_data' = 'insufficient_data';
    let peakScore = 0;

    if (nonEmptyWindows.length > 0) {
      const best = nonEmptyWindows.reduce((a, b) => (b.score > a.score ? b : a));
      peakWindow = best.window;
      peakScore = best.score;
    }

    let consistency = 0;
    if (nonEmptyWindows.length > 1) {
      const scores = nonEmptyWindows.map((ws) => ws.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const max = Math.max(...scores);
      consistency = mean > 0 ? Math.min(100, Math.round((max / mean) * 100)) : 0;
    }

    agents.push({
      agentId: `agent-${agentIdx}`,
      agentName: persona,
      agentRole: persona,
      totalSessions,
      windows: windowStats,
      peakWindow,
      peakScore,
      consistency,
    });
  }

  agents.sort((a, b) => b.peakScore - a.peakScore);

  const agentsWithPeak = agents.filter((a) => a.peakWindow !== 'insufficient_data');

  const peakWindowCounts = new Map<string, number>();
  for (const a of agentsWithPeak) {
    const w = a.peakWindow as string;
    peakWindowCounts.set(w, (peakWindowCounts.get(w) ?? 0) + 1);
  }

  let mostCommonPeakWindow = 'N/A';
  let maxCount = 0;
  for (const [w, count] of peakWindowCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonPeakWindow = getPeakLabel(w as PeakWindow);
    }
  }

  const avgPeakScore =
    agentsWithPeak.length > 0
      ? Math.round(agentsWithPeak.reduce((s, a) => s + a.peakScore, 0) / agentsWithPeak.length)
      : 0;

  const aiSummary = `Peak performance analysis identified ${agentsWithPeak.length} of ${agents.length} agents with sufficient data. The most common peak window is ${mostCommonPeakWindow} with an average peak score of ${avgPeakScore}.`;

  const aiRecommendations = [
    'Schedule high-priority tasks during each agent\'s peak performance window.',
    'Agents with variable consistency may benefit from more structured workflows.',
    'Consider redistributing complex tickets to agents whose peak windows align with business hours.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      agentsWithPeak: agentsWithPeak.length,
      mostCommonPeakWindow,
      avgPeakScore,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
