import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentSuccessRateData {
  personaId: string;
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  abandonedSessions: number;
  successRate: number;
  avgDurationMinutes: number;
  reliabilityTier: 'reliable' | 'adequate' | 'concerning' | 'critical';
}

export interface AgentSuccessRateReport {
  projectId: string;
  agents: AgentSuccessRateData[];
  projectSuccessRate: number;
  mostReliableAgent: string | null;
  mostFragileAgent: string | null;
  criticalAgentsCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Success rate analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review agents with critical reliability tier.'];

export type SessionRow = {
  ticketId: string | null;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function computeReliabilityTier(successRate: number): AgentSuccessRateData['reliabilityTier'] {
  if (successRate >= 85) return 'reliable';
  if (successRate >= 70) return 'adequate';
  if (successRate >= 50) return 'concerning';
  return 'critical';
}

export function buildSuccessRateProfiles(sessionRows: SessionRow[]): AgentSuccessRateData[] {
  const agentSet = new Set<string>();
  for (const s of sessionRows) agentSet.add(s.personaType);

  const profiles: AgentSuccessRateData[] = [];

  for (const personaId of agentSet) {
    const agentSess = sessionRows.filter((s) => s.personaType === personaId);
    const totalSessions = agentSess.length;

    const successfulSessions = agentSess.filter((s) => s.status === 'completed').length;
    const failedSessions = agentSess.filter((s) => s.status === 'failed').length;
    const abandonedSessions = agentSess.filter(
      (s) => s.status === 'aborted' || s.status === 'timed_out',
    ).length;

    const successRate = totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0;

    const completedWithDuration = agentSess.filter(
      (s) => s.status === 'completed' && s.startedAt !== null && s.completedAt !== null,
    );
    const avgDurationMinutes =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, s) => {
            const mins = (s.completedAt!.getTime() - s.startedAt!.getTime()) / 60000;
            return sum + Math.max(0, mins);
          }, 0) / completedWithDuration.length
        : 0;

    profiles.push({
      personaId,
      totalSessions,
      successfulSessions,
      failedSessions,
      abandonedSessions,
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMinutes: Math.round(avgDurationMinutes * 100) / 100,
      reliabilityTier: computeReliabilityTier(successRate),
    });
  }

  profiles.sort((a, b) => b.successRate - a.successRate);
  return profiles;
}

export async function analyzeAgentSuccessRate(projectId: string): Promise<AgentSuccessRateReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildSuccessRateProfiles(allSessions);

  const projectSuccessRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.successRate, 0) / agents.length) * 100) / 100
      : 0;

  const qualified = agents.filter((a) => a.totalSessions >= 3);
  const mostReliableAgent = qualified.length > 0 ? qualified[0].personaId : null;
  const mostFragileAgent = qualified.length > 1 ? qualified[qualified.length - 1].personaId : null;

  const criticalAgentsCount = agents.filter((a) => a.reliabilityTier === 'critical').length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.personaId}: tier=${a.reliabilityTier}, successRate=${a.successRate.toFixed(1)}%, sessions=${a.totalSessions}`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent success rate data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall reliability health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Success rate AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    projectSuccessRate,
    mostReliableAgent,
    mostFragileAgent,
    criticalAgentsCount,
    aiSummary,
    aiRecommendations,
  };
}
