import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentInstructionParseAccuracyMetric {
  agentId: string;
  agentName: string;
  accuracyScore: number;
  totalInstructions: number;
  correctlyParsed: number;
  misinterpreted: number;
  clarificationRequests: number;
  avgClarificationRounds: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentInstructionParseAccuracyReport {
  metrics: AgentInstructionParseAccuracyMetric[];
  fleetAvgAccuracyScore: number;
  lowAccuracyAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentInstructionParseAccuracy(): Promise<AgentInstructionParseAccuracyReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = (session as any).agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const metrics: AgentInstructionParseAccuracyMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Derive instruction parse data from session fields
    const totalInstructions = total * 2; // proxy: avg 2 instructions per session
    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const retryTotal = sorted.reduce((sum, s) => sum + (s.retryCount ?? 0), 0);

    const misinterpreted = Math.round((errorSessions / total) * totalInstructions * 0.7);
    const clarificationRequests = Math.round((retryTotal / total) * totalInstructions * 0.3);
    const correctlyParsed = Math.max(0, totalInstructions - misinterpreted - clarificationRequests);

    const accuracyScore = totalInstructions === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((correctlyParsed / totalInstructions) * 100)));

    const avgClarificationRounds = clarificationRequests > 0
      ? Math.round((retryTotal / Math.max(1, clarificationRequests)) * 10) / 10
      : 0;

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentErrors = recent.filter(s => s.status === 'error').length / Math.max(1, recent.length);
    const olderErrors = older.filter(s => s.status === 'error').length / Math.max(1, older.length);
    const trend: AgentInstructionParseAccuracyMetric['trend'] =
      recentErrors < olderErrors - 0.05 ? 'improving' :
      recentErrors > olderErrors + 0.05 ? 'degrading' : 'stable';

    const rating: AgentInstructionParseAccuracyMetric['rating'] =
      accuracyScore >= 80 ? 'excellent' :
      accuracyScore >= 60 ? 'good' :
      accuracyScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      accuracyScore,
      totalInstructions,
      correctlyParsed,
      misinterpreted,
      clarificationRequests,
      avgClarificationRounds,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.accuracyScore - a.accuracyScore);

  const fleetAvgAccuracyScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.accuracyScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgAccuracyScore,
    lowAccuracyAgents: metrics.filter(m => m.accuracyScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
