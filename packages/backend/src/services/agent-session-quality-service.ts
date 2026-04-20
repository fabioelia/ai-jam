import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentSessionQualityMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  avgSessionScore: number;
  outputCompleteness: number;
  handoffRate: number;
  avgSessionDurationMinutes: number;
  qualityTier: 'excellent' | 'good' | 'adequate' | 'poor';
}

export interface AgentSessionQualityReport {
  projectId: string;
  agents: AgentSessionQualityMetrics[];
  avgQualityScore: number;
  highQualityAgents: number;
  topAgent: string | null;
  sessionQualityCategories: { excellent: number; good: number; adequate: number; poor: number };
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSessionQualityScore(
  outputCompleteness: number,
  handoffRate: number,
): number {
  return Math.max(0, Math.min(100, Math.round(outputCompleteness * 0.6 + handoffRate * 0.4)));
}

export function computeSessionQualityTier(
  score: number,
): AgentSessionQualityMetrics['qualityTier'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'adequate';
  return 'poor';
}

export async function analyzeAgentSessionQuality(
  projectId: string,
): Promise<AgentSessionQualityReport> {
  const emptyReport: AgentSessionQualityReport = {
    projectId,
    agents: [],
    avgQualityScore: 0,
    highQualityAgents: 0,
    topAgent: null,
    sessionQualityCategories: { excellent: 0, good: 0, adequate: 0, poor: 0 },
    aiSummary: 'No agent sessions found for this project.',
    aiRecommendations: [],
  };

  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  if (ticketIds.length === 0) return emptyReport;

  const sessionRows = await db
    .select()
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) return emptyReport;

  // Group sessions by personaType
  const agentMap = new Map<
    string,
    { totalSessions: number; withOutput: number; completed: number; durationMinutes: number }
  >();

  for (const s of sessionRows) {
    const id = s.personaType;
    if (!agentMap.has(id)) {
      agentMap.set(id, { totalSessions: 0, withOutput: 0, completed: 0, durationMinutes: 0 });
    }
    const e = agentMap.get(id)!;
    e.totalSessions += 1;
    if (s.outputSummary !== null && s.outputSummary !== undefined && s.outputSummary !== '') {
      e.withOutput += 1;
    }
    if (s.status === 'completed') {
      e.completed += 1;
    }
    const dur =
      s.completedAt && s.startedAt
        ? (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000
        : 0;
    e.durationMinutes += Math.max(0, dur);
  }

  const agents: AgentSessionQualityMetrics[] = [];

  for (const [personaType, d] of agentMap.entries()) {
    const outputCompleteness = d.totalSessions > 0 ? (d.withOutput / d.totalSessions) * 100 : 0;
    const handoffRate = d.totalSessions > 0 ? (d.completed / d.totalSessions) * 100 : 0;
    const avgSessionDurationMinutes =
      d.totalSessions > 0 ? Math.round((d.durationMinutes / d.totalSessions) * 100) / 100 : 0;
    const avgSessionScore = computeSessionQualityScore(outputCompleteness, handoffRate);
    const qualityTier = computeSessionQualityTier(avgSessionScore);

    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalSessions: d.totalSessions,
      avgSessionScore,
      outputCompleteness: Math.round(outputCompleteness * 10) / 10,
      handoffRate: Math.round(handoffRate * 10) / 10,
      avgSessionDurationMinutes,
      qualityTier,
    });
  }

  agents.sort((a, b) => b.avgSessionScore - a.avgSessionScore);

  const avgQualityScore =
    agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.avgSessionScore, 0) / agents.length)
      : 0;

  const highQualityAgents = agents.filter(
    (a) => a.qualityTier === 'excellent' || a.qualityTier === 'good',
  ).length;

  const topAgent = agents.length > 0 ? agents[0].agentName : null;

  const sessionQualityCategories = {
    excellent: agents.filter((a) => a.qualityTier === 'excellent').length,
    good: agents.filter((a) => a.qualityTier === 'good').length,
    adequate: agents.filter((a) => a.qualityTier === 'adequate').length,
    poor: agents.filter((a) => a.qualityTier === 'poor').length,
  };

  const aiSummary = `Analyzed ${agents.length} agent(s) across ${sessionRows.length} session(s). Average quality score: ${avgQualityScore}/100. ${highQualityAgents} agent(s) performing at good or excellent tier.`;

  const aiRecommendations: string[] = [];
  if (sessionQualityCategories.poor > 0) {
    aiRecommendations.push(
      `${sessionQualityCategories.poor} agent(s) in poor tier — review their session outputs and completion rates.`,
    );
  }
  if (avgQualityScore < 60) {
    aiRecommendations.push('Overall quality score is below acceptable threshold. Consider auditing agent prompts and output requirements.');
  } else {
    aiRecommendations.push('Session quality is within acceptable range. Continue monitoring output completeness.');
  }

  return {
    projectId,
    agents,
    avgQualityScore,
    highQualityAgents,
    topAgent,
    sessionQualityCategories,
    aiSummary,
    aiRecommendations,
  };
}
