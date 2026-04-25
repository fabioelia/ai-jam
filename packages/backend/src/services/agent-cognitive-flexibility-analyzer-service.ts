import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentCognitiveFlexibilityMetric {
  agentId: string;
  sessionId: string;
  cognitiveFlexibilityScore: number;
  strategyPivotCount: number;
  avgRecoveryTimeMs: number;
  solutionDiversityIndex: number;
  failureAdaptationRate: number;
  rigidityRisk: 'low' | 'moderate' | 'high';
}

export interface AgentCognitiveFlexibilityReport {
  agents: AgentCognitiveFlexibilityMetric[];
  summary: {
    mostFlexible: string;
    leastFlexible: string;
    avgScore: number;
  };
}

export async function analyzeAgentCognitiveFlexibilityAnalyzer(projectId: string): Promise<AgentCognitiveFlexibilityReport> {
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

  const agents: AgentCognitiveFlexibilityMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const errorSessions = sorted.filter(s => s.status === 'error');
    const completedSessions = sorted.filter(s => s.status === 'completed');

    // Strategy pivots: transitions from error to completed
    let pivotCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].status === 'error' && sorted[i].status === 'completed') {
        pivotCount++;
      }
    }

    // Recovery time: avg time from error to next completed
    const recoveryTimes: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].status === 'error' && sorted[i].status === 'completed') {
        const diff = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
        recoveryTimes.push(Math.abs(diff));
      }
    }
    const avgRecoveryTimeMs = recoveryTimes.length > 0
      ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
      : 1000;

    // Solution diversity: unique statuses / total
    const uniqueStatuses = new Set(sorted.map(s => s.status)).size;
    const solutionDiversityIndex = Math.round(Math.min(1.0, uniqueStatuses / 4) * 1000) / 1000;

    // Failure adaptation rate: pivots / max(1, errors)
    const failureAdaptationRate = Math.round(
      Math.min(1.0, pivotCount / Math.max(1, errorSessions.length)) * 1000
    ) / 1000;

    // Cognitive flexibility score
    const completionRate = completedSessions.length / Math.max(1, totalSessions);
    const pivotBonus = Math.min(0.3, pivotCount * 0.05);
    const cognitiveFlexibilityScore = Math.round(
      Math.min(1.0, completionRate * 0.5 + failureAdaptationRate * 0.3 + solutionDiversityIndex * 0.1 + pivotBonus + 0.1) * 1000
    ) / 1000;

    const rigidityRisk: 'low' | 'moderate' | 'high' =
      cognitiveFlexibilityScore >= 0.6 ? 'low' :
      cognitiveFlexibilityScore >= 0.3 ? 'moderate' : 'high';

    agents.push({
      agentId,
      sessionId: sorted[sorted.length - 1]?.id ?? agentId,
      cognitiveFlexibilityScore,
      strategyPivotCount: pivotCount,
      avgRecoveryTimeMs,
      solutionDiversityIndex,
      failureAdaptationRate,
      rigidityRisk,
    });
  }

  agents.sort((a, b) => b.cognitiveFlexibilityScore - a.cognitiveFlexibilityScore);

  const avgScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.cognitiveFlexibilityScore, 0) / agents.length * 1000) / 1000
    : 0;

  return {
    agents,
    summary: {
      mostFlexible: agents[0]?.agentId ?? '',
      leastFlexible: agents[agents.length - 1]?.agentId ?? '',
      avgScore,
    },
  };
}
