import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentInformationDensityAnalyzerReport {
  density_score: number;
  high_density_rate: number;
  low_density_rate: number;
  verbosity_rate: number;
  terseness_rate: number;
  avg_density: number;
  trend: 'improving' | 'stable' | 'degrading';
  most_dense_agent: string;
  least_dense_agent: string;
  total_sessions: number;
  analysis_timestamp: string;
}

export async function analyzeAgentInformationDensityAnalyzer(): Promise<AgentInformationDensityAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      density_score: 0,
      high_density_rate: 0,
      low_density_rate: 0,
      verbosity_rate: 0,
      terseness_rate: 0,
      avg_density: 0,
      trend: 'stable',
      most_dense_agent: '',
      least_dense_agent: '',
      total_sessions: 0,
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agentDensities: { agentId: string; avgDensity: number }[] = [];

  let totalHighDensity = 0;
  let totalLowDensity = 0;
  let totalVerbose = 0;
  let totalTerse = 0;
  let totalDensitySum = 0;

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const densities = sorted.map(s => {
      // Proxy density via session duration and outcome
      const dur = s.completedAt && s.startedAt
        ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
        : 60000;
      const success = s.status === 'completed' ? 1 : 0;
      // short successful sessions = high density; long failed = low density
      const normalizedDur = Math.min(dur / 300000, 1); // normalize to 5 min cap
      const density = Math.round((success * 0.6 + (1 - normalizedDur) * 0.4) * 100);
      return Math.max(0, Math.min(100, density));
    });

    const avgDensity = densities.length > 0
      ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length)
      : 0;

    const highDensity = densities.filter(d => d >= 70).length;
    const lowDensity = densities.filter(d => d < 30).length;
    // Verbose = sessions that are long but low density
    const verbose = densities.filter(d => d < 40).length;
    // Terse = sessions that are short but also low outcome
    const terse = densities.filter(d => d > 0 && d < 30).length;

    totalHighDensity += highDensity;
    totalLowDensity += lowDensity;
    totalVerbose += verbose;
    totalTerse += terse;
    totalDensitySum += avgDensity * sorted.length;

    agentDensities.push({ agentId, avgDensity });
  }

  const total = sessions.length;
  const avgDensity = total > 0 ? Math.round(totalDensitySum / total) : 0;
  const highDensityRate = total > 0 ? Math.round((totalHighDensity / total) * 100) : 0;
  const lowDensityRate = total > 0 ? Math.round((totalLowDensity / total) * 100) : 0;
  const verbosityRate = total > 0 ? Math.round((totalVerbose / total) * 100) : 0;
  const tersenessRate = total > 0 ? Math.round((totalTerse / total) * 100) : 0;

  const densityScore = Math.max(0, Math.min(100,
    avgDensity * 0.5 + highDensityRate * 0.3 - lowDensityRate * 0.2
  ));

  // Trend via halves
  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentCompleted = recent.filter(s => s.status === 'completed').length / Math.max(recent.length, 1);
  const olderCompleted = older.filter(s => s.status === 'completed').length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentCompleted > olderCompleted + 0.05 ? 'improving' :
    recentCompleted < olderCompleted - 0.05 ? 'degrading' : 'stable';

  agentDensities.sort((a, b) => b.avgDensity - a.avgDensity);
  const mostDense = agentDensities[0]?.agentId ?? '';
  const leastDense = agentDensities[agentDensities.length - 1]?.agentId ?? '';

  return {
    density_score: Math.round(densityScore),
    high_density_rate: highDensityRate,
    low_density_rate: lowDensityRate,
    verbosity_rate: verbosityRate,
    terseness_rate: tersenessRate,
    avg_density: avgDensity,
    trend,
    most_dense_agent: mostDense,
    least_dense_agent: leastDense,
    total_sessions: total,
    analysis_timestamp: new Date().toISOString(),
  };
}
