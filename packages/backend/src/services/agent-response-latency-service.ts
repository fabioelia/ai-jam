import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentLatencyData {
  personaId: string;
  totalSessions: number;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  sessionsUnder5min: number;
  sessionsOver30min: number;
  fastCompletionRate: number;
  stallRate: number;
  latencyTier: 'fast' | 'moderate' | 'slow' | 'stalled';
}

export interface AgentResponseLatencyReport {
  projectId: string;
  agents: AgentLatencyData[];
  fastestAgent: string | null;
  slowestAgent: string | null;
  avgProjectLatencyMinutes: number;
  stallRiskCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Response latency analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Monitor agent session durations to identify stalled workflows.'];

export function computeLatencyTier(avgDurationMinutes: number): AgentLatencyData['latencyTier'] {
  if (avgDurationMinutes < 5) return 'fast';
  if (avgDurationMinutes < 15) return 'moderate';
  if (avgDurationMinutes < 30) return 'slow';
  return 'stalled';
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

type SessionRow = {
  personaType: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function buildLatencyProfiles(sessions: SessionRow[]): AgentLatencyData[] {
  const agentDurations = new Map<string, number[]>();

  for (const s of sessions) {
    if (!s.startedAt || !s.completedAt) continue;
    const durationMinutes = (s.completedAt.getTime() - s.startedAt.getTime()) / 60000;
    if (durationMinutes < 0) continue;
    if (!agentDurations.has(s.personaType)) agentDurations.set(s.personaType, []);
    agentDurations.get(s.personaType)!.push(durationMinutes);
  }

  const profiles: AgentLatencyData[] = [];

  for (const [personaId, durations] of agentDurations.entries()) {
    const totalSessions = durations.length;
    const avgDurationMinutes = durations.reduce((s, v) => s + v, 0) / totalSessions;
    const medianDurationMinutes = computeMedian(durations);
    const minDurationMinutes = Math.min(...durations);
    const maxDurationMinutes = Math.max(...durations);
    const sessionsUnder5min = durations.filter((d) => d < 5).length;
    const sessionsOver30min = durations.filter((d) => d >= 30).length;
    const fastCompletionRate = (sessionsUnder5min / totalSessions) * 100;
    const stallRate = (sessionsOver30min / totalSessions) * 100;

    profiles.push({
      personaId,
      totalSessions,
      avgDurationMinutes: Math.round(avgDurationMinutes * 100) / 100,
      medianDurationMinutes: Math.round(medianDurationMinutes * 100) / 100,
      minDurationMinutes: Math.round(minDurationMinutes * 100) / 100,
      maxDurationMinutes: Math.round(maxDurationMinutes * 100) / 100,
      sessionsUnder5min,
      sessionsOver30min,
      fastCompletionRate: Math.round(fastCompletionRate * 100) / 100,
      stallRate: Math.round(stallRate * 100) / 100,
      latencyTier: computeLatencyTier(avgDurationMinutes),
    });
  }

  return profiles;
}

export async function analyzeAgentResponseLatency(projectId: string): Promise<AgentResponseLatencyReport> {
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
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildLatencyProfiles(allSessions);

  const avgProjectLatencyMinutes =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.avgDurationMinutes, 0) / agents.length) * 100) / 100
      : 0;

  const qualified = agents.filter((a) => a.totalSessions >= 3);
  const fastestAgent =
    qualified.length > 0
      ? qualified.reduce((min, a) => (a.avgDurationMinutes < min.avgDurationMinutes ? a : min)).personaId
      : null;
  const slowestAgent =
    qualified.length > 0
      ? qualified.reduce((max, a) => (a.avgDurationMinutes > max.avgDurationMinutes ? a : max)).personaId
      : null;

  const stallRiskCount = agents.filter((a) => a.stallRate > 20).length;

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
          `${a.personaId}: tier=${a.latencyTier}, avg=${a.avgDurationMinutes}m, stallRate=${a.stallRate}%`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent response latency data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall latency health\n- recommendations: array of 2-3 actionable recommendations to improve response speed\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Response latency AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    fastestAgent,
    slowestAgent,
    avgProjectLatencyMinutes,
    stallRiskCount,
    aiSummary,
    aiRecommendations,
  };
}
