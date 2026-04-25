import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentInteractionRichnessAnalyzerMetric {
  agentId: string;
  agentName: string;
  interactionRichnessScore: number;
  avgTurnsPerSession: number;
  toolVarietyIndex: number;
  contextDepthScore: number;
  informationDensity: number;
  totalSessions: number;
  richnessCategory: 'shallow' | 'moderate' | 'rich' | 'deep';
}

export interface AgentInteractionRichnessAnalyzerReport {
  metrics: AgentInteractionRichnessAnalyzerMetric[];
  fleetAvgRichnessScore: number;
  deepInteractionAgents: number;
  shallowInteractionAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentInteractionRichnessAnalyzer(): Promise<AgentInteractionRichnessAnalyzerReport> {
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

  const metrics: AgentInteractionRichnessAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const totalSessions = agentSessionList.length;

    const durations = agentSessionList
      .map(s => {
        const start = s.startedAt ? new Date(s.startedAt).getTime() : new Date(s.createdAt).getTime();
        const end = s.completedAt ? new Date(s.completedAt).getTime() : null;
        return end ? end - start : null;
      })
      .filter((d): d is number => d !== null && d > 0);

    const avgDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Proxy: longer sessions = more turns
    const avgTurnsPerSession = Math.min(20, Math.max(2, Math.round(avgDurationMs / 180000) + 2));

    // Tool variety: derived from spread of session durations (variance proxy)
    const durationVariance = durations.length > 1
      ? durations.reduce((sum, d) => sum + Math.pow(d - avgDurationMs, 2), 0) / durations.length
      : 0;
    const toolVarietyIndex = Math.min(0.9, Math.max(0.1,
      Math.round((0.1 + (Math.sqrt(durationVariance) / Math.max(1, avgDurationMs)) * 0.8) * 100) / 100
    ));

    // Context depth: ratio of completed sessions
    const completedCount = agentSessionList.filter(s => s.status === 'completed' || s.completedAt).length;
    const contextDepthScore = Math.min(1.0, Math.max(0.1,
      Math.round((completedCount / Math.max(1, totalSessions)) * 100) / 100
    ));

    // Information density: sessions with above-avg duration
    const aboveAvgCount = durations.filter(d => d > avgDurationMs).length;
    const informationDensity = Math.min(0.8, Math.max(0.2,
      Math.round((0.2 + (aboveAvgCount / Math.max(1, totalSessions)) * 0.6) * 100) / 100
    ));

    const interactionRichnessScore = Math.round(
      (avgTurnsPerSession / 20 * 0.3 + toolVarietyIndex * 0.25 + contextDepthScore * 0.25 + informationDensity * 0.2) * 100
    ) / 100;

    const richnessCategory: AgentInteractionRichnessAnalyzerMetric['richnessCategory'] =
      interactionRichnessScore >= 0.75 ? 'deep' :
      interactionRichnessScore >= 0.5 ? 'rich' :
      interactionRichnessScore >= 0.25 ? 'moderate' : 'shallow';

    metrics.push({
      agentId,
      agentName: agentId,
      interactionRichnessScore,
      avgTurnsPerSession,
      toolVarietyIndex,
      contextDepthScore,
      informationDensity,
      totalSessions,
      richnessCategory,
    });
  }

  metrics.sort((a, b) => b.interactionRichnessScore - a.interactionRichnessScore);

  const fleetAvgRichnessScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.interactionRichnessScore, 0) / metrics.length * 100) / 100
    : 0;

  return {
    metrics,
    fleetAvgRichnessScore,
    deepInteractionAgents: metrics.filter(m => m.richnessCategory === 'deep').length,
    shallowInteractionAgents: metrics.filter(m => m.richnessCategory === 'shallow').length,
    analysisTimestamp: new Date().toISOString(),
  };
}
