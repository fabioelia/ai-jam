import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentCrossDomainTransferAnalyzerMetric {
  agentId: string;
  agentName: string;
  domainDiversityScore: number;
  crossDomainConsistency: number;
  adaptationRate: number;
  specializationIndex: number;
  transferScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentCrossDomainTransferAnalyzerReport {
  metrics: AgentCrossDomainTransferAnalyzerMetric[];
  fleetAvgTransferScore: number;
  narrowSpecialistAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentCrossDomainTransferAnalyzer(): Promise<AgentCrossDomainTransferAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const metrics: AgentCrossDomainTransferAnalyzerMetric[] = [];

  for (const [agentId, agSessions] of agentMap) {
    if (agSessions.length < 2) continue;

    const sorted = agSessions.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;

    const statusCounts = new Map<string, number>();
    for (const s of sorted) {
      const status = s.status ?? 'unknown';
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    const uniqueStatuses = statusCounts.size;
    const domainDiversityScore = Math.min(100, uniqueStatuses * 20);

    const dominantCount = Math.max(...statusCounts.values());
    const specializationIndex = Math.round((dominantCount / totalSessions) * 100);

    const durations = sorted.map(s => {
      if (s.completedAt && s.startedAt) {
        return new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
      }
      return 30000;
    });
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / totalSessions;
    const variance = durations.reduce((sum, d) => sum + (d - avgDuration) ** 2, 0) / totalSessions;
    const stdDev = Math.sqrt(variance);
    const coeffVariation = avgDuration > 0 ? (stdDev / avgDuration) * 100 : 100;
    const crossDomainConsistency = Math.max(0, Math.min(100, 100 - coeffVariation));

    let switches = 0;
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i].status ?? 'unknown') !== (sorted[i - 1].status ?? 'unknown')) {
        switches++;
      }
    }
    const adaptationRate = Math.min(100, (switches / (totalSessions - 1)) * 100 * 1.5);

    const transferScore = Math.min(100, Math.max(0,
      domainDiversityScore * 0.35 +
      crossDomainConsistency * 0.35 +
      adaptationRate * 0.2 +
      (100 - specializationIndex) * 0.1
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentDiversity = new Set(recent.map(s => s.status ?? 'unknown')).size;
    const olderDiversity = new Set(older.map(s => s.status ?? 'unknown')).size;
    const trend = recentDiversity > olderDiversity ? 'improving' : recentDiversity < olderDiversity ? 'degrading' : 'stable';
    const rating = transferScore >= 80 ? 'excellent' : transferScore >= 60 ? 'good' : transferScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      domainDiversityScore: Math.round(domainDiversityScore),
      crossDomainConsistency: Math.round(crossDomainConsistency * 10) / 10,
      adaptationRate: Math.round(adaptationRate * 10) / 10,
      specializationIndex,
      transferScore: Math.round(transferScore),
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.transferScore - a.transferScore);

  const fleetAvgTransferScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.transferScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgTransferScore,
    narrowSpecialistAgents: metrics.filter(m => m.specializationIndex > 70).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
