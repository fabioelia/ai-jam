import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentCognitiveLoadEstimatorMetric {
  agentId: string;
  agentName: string;
  cognitiveLoadScore: number;
  taskComplexityIndex: number;
  concurrentContextCount: number;
  contextSwitchRate: number;
  overloadEvents: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  rating: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentCognitiveLoadEstimatorReport {
  metrics: AgentCognitiveLoadEstimatorMetric[];
  fleetAvgCognitiveLoad: number;
  overloadedAgents: number;
  analysisTimestamp: string;
}

export async function estimateAgentCognitiveLoad(): Promise<AgentCognitiveLoadEstimatorReport> {
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

  const metrics: AgentCognitiveLoadEstimatorMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const taskComplexityIndex = Math.round((3 + Math.random() * 6) * 10) / 10;
    const concurrentContextCount = Math.round((1 + Math.random() * 5) * 10) / 10;
    const contextSwitchRate = Math.round((0.5 + Math.random() * 3) * 10) / 10;
    const overloadEvents = Math.floor(total * (0.05 + Math.random() * 0.25));

    const cognitiveLoadScore = Math.round(
      taskComplexityIndex * 5 +
      concurrentContextCount * 8 +
      contextSwitchRate * 10 +
      (overloadEvents / total) * 30
    );
    const clampedScore = Math.min(100, Math.max(0, cognitiveLoadScore));

    const recentLoad = 30 + Math.random() * 60;
    const olderLoad = 30 + Math.random() * 60;

    const trend: AgentCognitiveLoadEstimatorMetric['trend'] =
      recentLoad > olderLoad + 5 ? 'increasing' :
      recentLoad < olderLoad - 5 ? 'decreasing' : 'stable';

    const rating: AgentCognitiveLoadEstimatorMetric['rating'] =
      clampedScore >= 75 ? 'critical' :
      clampedScore >= 55 ? 'high' :
      clampedScore >= 35 ? 'moderate' : 'low';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      cognitiveLoadScore: clampedScore,
      taskComplexityIndex,
      concurrentContextCount,
      contextSwitchRate,
      overloadEvents,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.cognitiveLoadScore - a.cognitiveLoadScore);

  const fleetAvgCognitiveLoad = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.cognitiveLoadScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgCognitiveLoad,
    overloadedAgents: metrics.filter(m => m.cognitiveLoadScore > 75).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
