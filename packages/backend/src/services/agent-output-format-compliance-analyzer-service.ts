import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentOutputFormatComplianceAnalyzerMetric {
  agentId: string;
  agentName: string;
  complianceRate: number;
  formatViolations: number;
  partialComplianceRate: number;
  avgComplianceScore: number;
  mostCommonViolation: string;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentOutputFormatComplianceAnalyzerReport {
  metrics: AgentOutputFormatComplianceAnalyzerMetric[];
  fleetAvgComplianceScore: number;
  highViolationAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentOutputFormatComplianceAnalyzer(): Promise<AgentOutputFormatComplianceAnalyzerReport> {
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

  const metrics: AgentOutputFormatComplianceAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completedSessions = sorted.filter(s => s.status === 'completed').length;
    const errorSessions = sorted.filter(s => s.status === 'error').length;

    const validOutputSessions = sorted.filter(s => s.status === 'completed' && (s.durationMs ?? 0) > 0).length;
    const complianceRate = totalSessions > 0 ? (validOutputSessions / totalSessions) * 100 : 100;

    const avgDuration = sorted.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / Math.max(1, totalSessions);
    const anomalousSessions = sorted.filter(s => {
      const dur = s.durationMs ?? 0;
      return s.status === 'completed' && (dur < avgDuration * 0.1 || dur > avgDuration * 10);
    }).length;
    const partialComplianceRate = totalSessions > 0 ? (anomalousSessions / totalSessions) * 100 : 0;

    const formatViolations = errorSessions + anomalousSessions;
    const mostCommonViolation = errorSessions >= anomalousSessions ? 'schema_mismatch' : 'truncated';

    const avgComplianceScore = Math.min(100, Math.max(0,
      complianceRate * 0.6 +
      (100 - partialComplianceRate) * 0.3 +
      (completedSessions / Math.max(1, totalSessions)) * 100 * 0.1
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentRate = recent.filter(s => s.status === 'completed').length / Math.max(1, recent.length) * 100;
    const olderRate = older.filter(s => s.status === 'completed').length / Math.max(1, older.length) * 100;
    const trend: AgentOutputFormatComplianceAnalyzerMetric['trend'] =
      recentRate > olderRate + 5 ? 'improving' : recentRate < olderRate - 5 ? 'degrading' : 'stable';

    const rating: AgentOutputFormatComplianceAnalyzerMetric['rating'] =
      avgComplianceScore >= 80 ? 'excellent' :
      avgComplianceScore >= 60 ? 'good' :
      avgComplianceScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      complianceRate: Math.round(complianceRate * 10) / 10,
      formatViolations,
      partialComplianceRate: Math.round(partialComplianceRate * 10) / 10,
      avgComplianceScore: Math.round(avgComplianceScore),
      mostCommonViolation,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.avgComplianceScore - a.avgComplianceScore);

  const fleetAvgComplianceScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.avgComplianceScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgComplianceScore,
    highViolationAgents: metrics.filter(m => m.complianceRate < 70).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
