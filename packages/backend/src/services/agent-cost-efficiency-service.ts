import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentCostEfficiencyMetrics {
  personaId: string;
  tokenBudgetUsed: number;
  totalSessions: number;
  completedSessions: number;
  avgTokensPerSession: number;
  costEfficiencyScore: number;
  efficiencyTier: 'optimal' | 'efficient' | 'moderate' | 'wasteful';
}

export interface AgentCostEfficiencyReport {
  projectId: string;
  agentMetrics: AgentCostEfficiencyMetrics[];
  totalTokensUsed: number;
  avgCostEfficiencyScore: number;
  mostEfficientAgent: string | null;
  leastEfficientAgent: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Cost efficiency analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review agents with wasteful efficiency tier to identify optimization opportunities.'];

export type SessionRow = {
  personaType: string;
  status: string;
  costTokensIn: number;
  costTokensOut: number;
};

export function computeEfficiencyTier(score: number): AgentCostEfficiencyMetrics['efficiencyTier'] {
  if (score >= 75) return 'optimal';
  if (score >= 55) return 'efficient';
  if (score >= 35) return 'moderate';
  return 'wasteful';
}

export function computeCostEfficiencyScore(
  totalSessions: number,
  completedSessions: number,
  avgTokensPerSession: number,
): number {
  if (totalSessions === 0) return 0;

  const completionRate = (completedSessions / totalSessions) * 100;
  const utilizationEfficiency = Math.max(0, Math.min(100, 100 - avgTokensPerSession / 1000));
  const sessionSuccessDensity = Math.min(completedSessions / 10, 1) * 100;

  return Math.round(completionRate * 0.5 + utilizationEfficiency * 0.3 + sessionSuccessDensity * 0.2);
}

export function buildCostEfficiencyProfiles(sessionRows: SessionRow[]): AgentCostEfficiencyMetrics[] {
  const agentSet = new Set<string>();
  for (const s of sessionRows) agentSet.add(s.personaType);

  const profiles: AgentCostEfficiencyMetrics[] = [];

  for (const personaId of agentSet) {
    const agentSessions = sessionRows.filter((s) => s.personaType === personaId);
    const totalSessions = agentSessions.length;
    const completedSessions = agentSessions.filter((s) => s.status === 'completed').length;
    const tokenBudgetUsed = agentSessions.reduce(
      (sum, s) => sum + (s.costTokensIn ?? 0) + (s.costTokensOut ?? 0),
      0,
    );
    const avgTokensPerSession = totalSessions > 0 ? tokenBudgetUsed / totalSessions : 0;
    const costEfficiencyScore = computeCostEfficiencyScore(totalSessions, completedSessions, avgTokensPerSession);

    profiles.push({
      personaId,
      tokenBudgetUsed,
      totalSessions,
      completedSessions,
      avgTokensPerSession: Math.round(avgTokensPerSession),
      costEfficiencyScore,
      efficiencyTier: computeEfficiencyTier(costEfficiencyScore),
    });
  }

  profiles.sort((a, b) => b.costEfficiencyScore - a.costEfficiencyScore);
  return profiles;
}

export async function analyzeAgentCostEfficiency(projectId: string): Promise<AgentCostEfficiencyReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        costTokensIn: agentSessions.costTokensIn,
        costTokensOut: agentSessions.costTokensOut,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agentMetrics = buildCostEfficiencyProfiles(allSessions);

  const totalTokensUsed = agentMetrics.reduce((s, a) => s + a.tokenBudgetUsed, 0);
  const avgCostEfficiencyScore =
    agentMetrics.length > 0
      ? Math.round(agentMetrics.reduce((s, a) => s + a.costEfficiencyScore, 0) / agentMetrics.length)
      : 0;

  const mostEfficientAgent = agentMetrics.length > 0 ? agentMetrics[0].personaId : null;
  const leastEfficientAgent = agentMetrics.length > 1 ? agentMetrics[agentMetrics.length - 1].personaId : null;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentMetrics
      .map(
        (a) =>
          `${a.personaId}: tier=${a.efficiencyTier}, score=${a.costEfficiencyScore}, tokens=${a.tokenBudgetUsed}, sessions=${a.totalSessions}, completed=${a.completedSessions}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent cost efficiency data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall cost efficiency\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Cost efficiency AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agentMetrics,
    totalTokensUsed,
    avgCostEfficiencyScore,
    mostEfficientAgent,
    leastEfficientAgent,
    aiSummary,
    aiRecommendations,
  };
}
