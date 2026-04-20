import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface PriorityGap {
  priority: 'critical' | 'high' | 'medium' | 'low';
  openTickets: number;
  unassignedCount: number;
  assignedAgents: string[];
  gapSeverity: 'critical' | 'moderate' | 'none';
}

export interface KnowledgeGapReport {
  projectId: string;
  gaps: PriorityGap[];
  topGap: string | null;
  insight: string;
  analyzedAt: string;
}

const PRIORITIES: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

// --- FEAT-114: Agent Knowledge Gap Analyzer ---

export interface DomainGap {
  domain: string;
  tasksAttempted: number;
  successRate: number;
  avgRetriesPerTask: number;
  escalationRate: number;
  knowledgeScore: number;
  gapSeverity: 'none' | 'minor' | 'moderate' | 'critical';
}

export interface AgentKnowledgeGapMetrics {
  agentId: string;
  agentName: string;
  totalTasksAnalyzed: number;
  avgDomainScore: number;
  proficiencyTier: 'specialist' | 'generalist' | 'developing' | 'struggling';
  domains: DomainGap[];
}

export interface AgentKnowledgeGapReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalDomains: number;
    criticalGapCount: number;
    mostStruggling: string;
    mostCoveredDomain: string;
  };
  agents: AgentKnowledgeGapMetrics[];
  insights: string[];
  recommendations: string[];
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  backend: ['api', 'backend', 'database', 'sql', 'migration', 'server', 'endpoint'],
  frontend: ['ui', 'frontend', 'react', 'component', 'css', 'modal', 'page'],
  testing: ['test', 'qa', 'spec', 'e2e', 'unit', 'playwright'],
  devops: ['deploy', 'ci', 'pipeline', 'docker', 'build', 'infra'],
  analysis: ['analyze', 'report', 'metrics', 'stats', 'insight'],
};

export function detectDomain(title: string = '', tags: string[] = []): string {
  const text = [title.toLowerCase(), ...tags.map((t) => t.toLowerCase())].join(' ');
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return domain;
  }
  return 'general';
}

export function computeKnowledgeScore(
  successRate: number,
  avgRetriesPerTask: number,
  escalationRate: number,
): number {
  const score =
    successRate * 0.5 +
    (100 - avgRetriesPerTask * 10) * 0.3 +
    (100 - escalationRate) * 0.2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getGapSeverity(score: number): DomainGap['gapSeverity'] {
  if (score >= 75) return 'none';
  if (score >= 50) return 'minor';
  if (score >= 25) return 'moderate';
  return 'critical';
}

export function getProficiencyTier(avgScore: number): AgentKnowledgeGapMetrics['proficiencyTier'] {
  if (avgScore >= 75) return 'specialist';
  if (avgScore >= 55) return 'generalist';
  if (avgScore >= 35) return 'developing';
  return 'struggling';
}

export function analyzeAgentKnowledgeGaps(
  projectId: string,
  sessions: any[],
): AgentKnowledgeGapReport {
  const now = new Date().toISOString();

  if (sessions.length === 0) {
    return {
      projectId,
      generatedAt: now,
      summary: { totalAgents: 0, totalDomains: 0, criticalGapCount: 0, mostStruggling: '', mostCoveredDomain: '' },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  const sessionsByAgent = new Map<string, any[]>();
  for (const s of sessions) {
    const agentId = s.agentId ?? s.personaType ?? 'unknown';
    const list = sessionsByAgent.get(agentId) ?? [];
    list.push(s);
    sessionsByAgent.set(agentId, list);
  }

  const agents: AgentKnowledgeGapMetrics[] = [];

  for (const [agentId, agentSessions] of sessionsByAgent.entries()) {
    const domainMap = new Map<string, any[]>();
    for (const s of agentSessions) {
      const domain = detectDomain(s.title, s.tags);
      const list = domainMap.get(domain) ?? [];
      list.push(s);
      domainMap.set(domain, list);
    }

    const domains: DomainGap[] = [];
    for (const [domain, ds] of domainMap.entries()) {
      const tasksAttempted = ds.length;
      const succeeded = ds.filter((s: any) => s.status === 'completed').length;
      const successRate = Math.round((succeeded / tasksAttempted) * 100);
      const totalRetries = ds.reduce((sum: number, s: any) => sum + (s.retries ?? 0), 0);
      const avgRetriesPerTask = tasksAttempted > 0 ? totalRetries / tasksAttempted : 0;
      const escalated = ds.filter((s: any) => s.escalated === true).length;
      const escalationRate = Math.round((escalated / tasksAttempted) * 100);
      const knowledgeScore = computeKnowledgeScore(successRate, avgRetriesPerTask, escalationRate);
      domains.push({ domain, tasksAttempted, successRate, avgRetriesPerTask, escalationRate, knowledgeScore, gapSeverity: getGapSeverity(knowledgeScore) });
    }

    const avgDomainScore =
      domains.length > 0
        ? Math.round(domains.reduce((sum, d) => sum + d.knowledgeScore, 0) / domains.length)
        : 0;

    agents.push({
      agentId,
      agentName: agentSessions[0]?.agentName ?? agentId,
      totalTasksAnalyzed: agentSessions.length,
      avgDomainScore,
      proficiencyTier: getProficiencyTier(avgDomainScore),
      domains,
    });
  }

  agents.sort((a, b) => b.avgDomainScore - a.avgDomainScore);

  const allDomains = agents.flatMap((a) => a.domains);
  const criticalGapCount = allDomains.filter((d) => d.gapSeverity === 'critical').length;
  const mostStruggling = agents.length > 0 ? agents[agents.length - 1].agentName : '';

  const domainScoreMap = new Map<string, number[]>();
  for (const d of allDomains) {
    const scores = domainScoreMap.get(d.domain) ?? [];
    scores.push(d.knowledgeScore);
    domainScoreMap.set(d.domain, scores);
  }
  let mostCoveredDomain = '';
  let highestAvg = -1;
  for (const [domain, scores] of domainScoreMap.entries()) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    if (avg > highestAvg) { highestAvg = avg; mostCoveredDomain = domain; }
  }

  const insights: string[] = [];
  if (criticalGapCount > 0) insights.push(`${criticalGapCount} critical knowledge gap(s) detected across domains.`);
  const specialists = agents.filter((a) => a.proficiencyTier === 'specialist');
  if (specialists.length > 0) insights.push(`${specialists.length} agent(s) achieved specialist tier.`);

  const recommendations: string[] = [];
  if (criticalGapCount > 0) recommendations.push('Provide targeted training for agents with critical domain gaps.');
  recommendations.push('Assign tasks aligned to agent domain strengths to improve outcomes.');

  return {
    projectId,
    generatedAt: now,
    summary: {
      totalAgents: agents.length,
      totalDomains: domainScoreMap.size,
      criticalGapCount,
      mostStruggling,
      mostCoveredDomain,
    },
    agents,
    insights,
    recommendations,
  };
}

export async function analyzeKnowledgeGaps(projectId: string): Promise<KnowledgeGapReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      priority: tickets.priority,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      storyPoints: tickets.storyPoints,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Filter open tickets (status !== 'done')
  const openTickets = allTickets.filter((t) => t.status !== 'done');

  const gaps: PriorityGap[] = [];

  for (const priority of PRIORITIES) {
    const priorityTickets = openTickets.filter((t) => t.priority === priority);
    const demand = priorityTickets.length;

    if (demand === 0) continue;

    const unassignedCount = priorityTickets.filter((t) => t.assignedPersona === null).length;
    const assignedAgents = [
      ...new Set(
        priorityTickets
          .map((t) => t.assignedPersona as string | null)
          .filter((p): p is string => p !== null),
      ),
    ];
    const agentCount = assignedAgents.length;

    let gapSeverity: 'critical' | 'moderate' | 'none';
    if (unassignedCount >= 3 || (agentCount === 0 && demand > 0)) {
      gapSeverity = 'critical';
    } else if (unassignedCount >= 1 && unassignedCount <= 2) {
      gapSeverity = 'moderate';
    } else {
      gapSeverity = 'none';
    }

    gaps.push({
      priority,
      openTickets: demand,
      unassignedCount,
      assignedAgents,
      gapSeverity,
    });
  }

  // Find topGap: priority with highest gapSeverity, break ties by unassignedCount
  const severityRank = { critical: 2, moderate: 1, none: 0 };
  let topGap: string | null = null;
  if (gaps.length > 0) {
    const best = gaps.reduce((prev, curr) => {
      const prevRank = severityRank[prev.gapSeverity];
      const currRank = severityRank[curr.gapSeverity];
      if (currRank > prevRank) return curr;
      if (currRank === prevRank && curr.unassignedCount > prev.unassignedCount) return curr;
      return prev;
    });
    if (best.gapSeverity !== 'none') {
      topGap = best.priority;
    }
  }

  // AI insight via OpenRouter
  let insight = 'Analysis based on current ticket assignment distribution';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = gaps
      .map(
        (g) =>
          `priority=${g.priority}: openTickets=${g.openTickets}, unassigned=${g.unassignedCount}, agents=${g.assignedAgents.join(', ') || 'none'}, severity=${g.gapSeverity}`,
      )
      .join('\n');

    const prompt = `You are an AI project analyst. Review this knowledge gap analysis for an AI agent team and summarize the most critical gap and recommended action.

Knowledge gap data by priority:
${summaryLines || 'No open tickets found.'}
Top gap priority: ${topGap ?? 'none'}

Respond with 2-3 sentences only. Focus on the most critical knowledge gap and what action should be taken. No JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) insight = content;
  } catch (e) {
    console.warn('Agent knowledge gap AI insight failed, using fallback:', e);
    insight = 'Analysis based on current ticket assignment distribution';
  }

  return {
    projectId,
    gaps,
    topGap,
    insight,
    analyzedAt: new Date().toISOString(),
  };
}
