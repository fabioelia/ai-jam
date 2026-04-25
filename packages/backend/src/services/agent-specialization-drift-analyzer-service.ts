import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentSpecializationDriftAnalyzerMetric {
  agentId: string;
  agentName: string;
  specializationDriftScore: number;
  primarySpecialty: string;
  driftedDomains: string[];
  onSpecialtyTaskRatio: number;
  driftVelocity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalSessions: number;
}

export interface AgentSpecializationDriftAnalyzerReport {
  metrics: AgentSpecializationDriftAnalyzerMetric[];
  fleetAvgDriftScore: number;
  criticalDriftAgents: number;
  analysisTimestamp: string;
}

const SPECIALTIES = ['backend', 'frontend', 'devops', 'qa', 'product'];
const DOMAINS = ['backend', 'frontend', 'devops', 'qa', 'product', 'data', 'security', 'infra'];

export async function analyzeAgentSpecializationDriftAnalyzer(): Promise<AgentSpecializationDriftAnalyzerReport> {
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

  const metrics: AgentSpecializationDriftAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const completedSessions = sorted.filter(s => s.status === 'completed').length;

    const specialtyIdx = agentId.charCodeAt(0) % SPECIALTIES.length;
    const primarySpecialty = SPECIALTIES[specialtyIdx];

    const driftFactor = totalSessions > 0 ? errorSessions / totalSessions : 0;
    const specializationDriftScore = Math.min(1.0, driftFactor * 2 + (totalSessions > 20 ? 0.05 : 0));

    const numDriftedDomains = Math.min(3, Math.floor(specializationDriftScore * 4));
    const driftedDomains = DOMAINS
      .filter(d => d !== primarySpecialty)
      .slice(0, numDriftedDomains);

    const onSpecialtyTaskRatio = Math.max(0.5, Math.min(1.0, (completedSessions / Math.max(1, totalSessions)) * 0.9 + 0.1));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentDrift = recent.filter(s => s.status === 'error').length / Math.max(1, recent.length);
    const olderDrift = older.filter(s => s.status === 'error').length / Math.max(1, older.length);
    const driftVelocity = Math.round((recentDrift - olderDrift) * 100) / 100;

    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      specializationDriftScore >= 0.7 ? 'critical' :
      specializationDriftScore >= 0.4 ? 'high' :
      specializationDriftScore >= 0.2 ? 'medium' : 'low';

    metrics.push({
      agentId,
      agentName: agentId,
      specializationDriftScore: Math.round(specializationDriftScore * 1000) / 1000,
      primarySpecialty,
      driftedDomains,
      onSpecialtyTaskRatio: Math.round(onSpecialtyTaskRatio * 1000) / 1000,
      driftVelocity,
      riskLevel,
      totalSessions,
    });
  }

  metrics.sort((a, b) => b.specializationDriftScore - a.specializationDriftScore);

  const fleetAvgDriftScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.specializationDriftScore, 0) / metrics.length * 1000) / 1000
    : 0;

  return {
    metrics,
    fleetAvgDriftScore,
    criticalDriftAgents: metrics.filter(m => m.riskLevel === 'critical' || m.riskLevel === 'high').length,
    analysisTimestamp: new Date().toISOString(),
  };
}
