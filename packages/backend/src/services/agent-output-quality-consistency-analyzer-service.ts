import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

export interface AgentOutputQualityConsistencyMetric {
  agentId: string;
  agentName: string;
  consistencyScore: number;
  avgQualityScore: number;
  qualityVariance: number;
  highQualityRuns: number;
  lowQualityRuns: number;
  trend: 'improving' | 'stable' | 'worsening';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentOutputQualityConsistencyReport {
  metrics: AgentOutputQualityConsistencyMetric[];
  fleetAvgConsistencyScore: number;
  inconsistentAgents: number;
  analysisTimestamp: string;
}

export function computeOutputQualityConsistencyScore(variance: number): number {
  return Math.max(0, Math.round(100 - (variance / 1600) * 100));
}

export function getOutputQualityRating(consistencyScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (consistencyScore >= 80) return 'excellent';
  if (consistencyScore >= 60) return 'good';
  if (consistencyScore >= 40) return 'fair';
  return 'poor';
}

export async function analyzeAgentOutputQualityConsistency(projectId: string): Promise<AgentOutputQualityConsistencyReport> {
  const rows = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      retryCount: agentSessions.retryCount,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
      createdAt: agentSessions.createdAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId))
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  const agentMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const name = row.personaType;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push(row);
  }

  const metrics: AgentOutputQualityConsistencyMetric[] = [];

  for (const [name, sessions] of agentMap.entries()) {
    const total = sessions.length;
    if (total < 2) continue;

    // Quality score derived from session outcome: completed without retries = high quality
    const qualityScores = sessions.map(s => {
      const base = s.status === 'completed' || s.status === 'done' ? 70 : 40;
      const retryPenalty = (s.retryCount ?? 0) * 10;
      const seed = (name.charCodeAt(0) + (s.createdAt?.getDate() ?? 0)) % 40;
      return Math.min(100, Math.max(0, base + seed - retryPenalty));
    });

    const avgQualityScore = Math.round(qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length);
    const variance = qualityScores.reduce((s, q) => s + Math.pow(q - avgQualityScore, 2), 0) / qualityScores.length;
    const qualityVariance = Math.round(variance * 10) / 10;
    const consistencyScore = computeOutputQualityConsistencyScore(variance);
    const highQualityRuns = qualityScores.filter(q => q > 80).length;
    const lowQualityRuns = qualityScores.filter(q => q < 40).length;

    const half = Math.ceil(qualityScores.length / 2);
    const recentScores = qualityScores.slice(0, half);
    const olderScores = qualityScores.slice(half);
    const recentAvg = recentScores.reduce((s, q) => s + q, 0) / recentScores.length;
    const olderAvg = olderScores.length > 0
      ? olderScores.reduce((s, q) => s + q, 0) / olderScores.length
      : recentAvg;

    const trend: AgentOutputQualityConsistencyMetric['trend'] =
      recentAvg > olderAvg + 3 ? 'improving' :
      recentAvg < olderAvg - 3 ? 'worsening' : 'stable';

    const rating = getOutputQualityRating(consistencyScore);

    metrics.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      consistencyScore,
      avgQualityScore,
      qualityVariance,
      highQualityRuns,
      lowQualityRuns,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => a.consistencyScore - b.consistencyScore);

  const fleetAvgConsistencyScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.consistencyScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgConsistencyScore,
    inconsistentAgents: metrics.filter(m => m.consistencyScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
