import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentSpecializationDepthMetric {
  agentId: string;
  depth_score: number;
  is_specialist: boolean;
  is_generalist: boolean;
  is_misallocated: boolean;
  top_domain: string;
}

export interface AgentSpecializationDepthReport {
  specialization_rate: number;
  domain_concentration_rate: number;
  cross_domain_task_rate: number;
  deep_specialist_count: number;
  generalist_count: number;
  misallocated_count: number;
  total_agents: number;
  avg_specialization_score: number;
  top_specialization_domains: string[];
  trend: 'improving' | 'stable' | 'degrading';
  most_specialized_agent: string;
  least_specialized_agent: string;
  analysis_timestamp: string;
}

const DOMAINS = [
  'backend-development',
  'frontend-development',
  'infrastructure',
  'data-analysis',
  'security',
  'testing-qa',
  'product-management',
  'devops',
];

function domainFromSession(session: { agentId: string | null; status: string }): string {
  const id = (session.agentId ?? '').toLowerCase();
  if (id.includes('backend') || id.includes('api')) return 'backend-development';
  if (id.includes('frontend') || id.includes('ui')) return 'frontend-development';
  if (id.includes('infra') || id.includes('cloud')) return 'infrastructure';
  if (id.includes('data') || id.includes('analyst')) return 'data-analysis';
  if (id.includes('sec') || id.includes('pentest')) return 'security';
  if (id.includes('qa') || id.includes('test')) return 'testing-qa';
  if (id.includes('product') || id.includes('pm')) return 'product-management';
  if (id.includes('devops') || id.includes('deploy')) return 'devops';
  const idx = Math.abs(hashCode(session.agentId ?? 'x')) % DOMAINS.length;
  return DOMAINS[idx];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function computeDepthScore(domainCounts: Map<string, number>, total: number): number {
  if (total === 0) return 0;
  let max = 0;
  for (const v of domainCounts.values()) if (v > max) max = v;
  return Math.min(100, Math.round((max / total) * 100));
}

export async function analyzeAgentSpecializationDepth(): Promise<AgentSpecializationDepthReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(200);

  if (sessions.length === 0) {
    return {
      specialization_rate: 0,
      domain_concentration_rate: 0,
      cross_domain_task_rate: 0,
      deep_specialist_count: 0,
      generalist_count: 0,
      misallocated_count: 0,
      total_agents: 0,
      avg_specialization_score: 0,
      top_specialization_domains: DOMAINS.slice(0, 3),
      trend: 'stable',
      most_specialized_agent: 'N/A',
      least_specialized_agent: 'N/A',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentDomains = new Map<string, Map<string, number>>();

  for (const s of sessions) {
    const agentId = s.agentId ?? 'unknown';
    const domain = domainFromSession(s);
    if (!agentDomains.has(agentId)) agentDomains.set(agentId, new Map());
    const dm = agentDomains.get(agentId)!;
    dm.set(domain, (dm.get(domain) ?? 0) + 1);
  }

  let deepSpecialistCount = 0;
  let generalistCount = 0;
  let misallocatedCount = 0;
  let scoreSum = 0;
  const agentScores: { id: string; score: number }[] = [];
  const domainPopularity = new Map<string, number>();

  for (const [agentId, domainMap] of agentDomains.entries()) {
    const total = [...domainMap.values()].reduce((a, b) => a + b, 0);
    const score = computeDepthScore(domainMap, total);
    const uniqueDomains = domainMap.size;

    const isSpecialist = score >= 70;
    const isGeneralist = uniqueDomains >= 4;
    const isMisallocated = isSpecialist && uniqueDomains > 3;

    if (isSpecialist) deepSpecialistCount++;
    else if (isGeneralist) generalistCount++;
    if (isMisallocated) misallocatedCount++;

    scoreSum += score;
    agentScores.push({ id: agentId, score });

    for (const [domain, cnt] of domainMap.entries()) {
      domainPopularity.set(domain, (domainPopularity.get(domain) ?? 0) + cnt);
    }
  }

  const totalAgents = agentDomains.size;
  const avgSpecializationScore = totalAgents > 0 ? scoreSum / totalAgents : 0;
  const specializationRate = totalAgents > 0 ? (deepSpecialistCount / totalAgents) * 100 : 0;

  const totalSessionCount = sessions.length;
  const uniqueDomainSessionCount = new Set(sessions.map(s => domainFromSession(s))).size;
  const domainConcentrationRate = totalSessionCount > 0
    ? Math.min(100, (uniqueDomainSessionCount === 1 ? 100 : 100 / uniqueDomainSessionCount) * 10)
    : 0;
  const crossDomainTaskRate = totalAgents > 0 ? (generalistCount / totalAgents) * 100 : 0;

  const topDomains = [...domainPopularity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);

  agentScores.sort((a, b) => b.score - a.score);
  const mostSpecialized = agentScores[0]?.id ?? 'N/A';
  const leastSpecialized = agentScores[agentScores.length - 1]?.id ?? 'N/A';

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);

  const recentAgents = new Map<string, Map<string, number>>();
  for (const s of recent) {
    const id = s.agentId ?? 'unknown';
    if (!recentAgents.has(id)) recentAgents.set(id, new Map());
    const dm = recentAgents.get(id)!;
    const domain = domainFromSession(s);
    dm.set(domain, (dm.get(domain) ?? 0) + 1);
  }
  const olderAgents = new Map<string, Map<string, number>>();
  for (const s of older) {
    const id = s.agentId ?? 'unknown';
    if (!olderAgents.has(id)) olderAgents.set(id, new Map());
    const dm = olderAgents.get(id)!;
    const domain = domainFromSession(s);
    dm.set(domain, (dm.get(domain) ?? 0) + 1);
  }

  const recentAvg = recentAgents.size > 0
    ? [...recentAgents.entries()].reduce((sum, [, dm]) => {
        const t = [...dm.values()].reduce((a, b) => a + b, 0);
        return sum + computeDepthScore(dm, t);
      }, 0) / recentAgents.size
    : 0;
  const olderAvg = olderAgents.size > 0
    ? [...olderAgents.entries()].reduce((sum, [, dm]) => {
        const t = [...dm.values()].reduce((a, b) => a + b, 0);
        return sum + computeDepthScore(dm, t);
      }, 0) / olderAgents.size
    : 0;

  const trend: 'improving' | 'stable' | 'degrading' =
    recentAvg > olderAvg * 1.1 ? 'improving' : recentAvg < olderAvg * 0.9 ? 'degrading' : 'stable';

  return {
    specialization_rate: Math.round(specializationRate * 10) / 10,
    domain_concentration_rate: Math.round(domainConcentrationRate * 10) / 10,
    cross_domain_task_rate: Math.round(crossDomainTaskRate * 10) / 10,
    deep_specialist_count: deepSpecialistCount,
    generalist_count: generalistCount,
    misallocated_count: misallocatedCount,
    total_agents: totalAgents,
    avg_specialization_score: Math.round(avgSpecializationScore * 10) / 10,
    top_specialization_domains: topDomains.length > 0 ? topDomains : DOMAINS.slice(0, 3),
    trend,
    most_specialized_agent: mostSpecialized,
    least_specialized_agent: leastSpecialized,
    analysis_timestamp: new Date().toISOString(),
  };
}
