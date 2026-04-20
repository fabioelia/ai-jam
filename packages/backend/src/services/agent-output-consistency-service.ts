import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentOutputConsistencyMetrics {
  agentId: string;
  agentName: string;
  totalOutputs: number;
  consistentOutputs: number;
  consistencyRate: number;
  formatAdherenceRate: number;
  outputConsistencyScore: number; // 0-100
  consistencyTier: 'consistent' | 'reliable' | 'variable' | 'erratic';
}

export interface AgentOutputConsistencyReport {
  projectId: string;
  agents: AgentOutputConsistencyMetrics[];
  avgConsistencyScore: number;
  mostConsistentAgent: string | null;
  leastConsistentAgent: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Output consistency analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Ensure agents with erratic output patterns receive clearer task specifications.',
  'Implement output format templates to improve format adherence rates.',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeOutputConsistencyScore(
  consistencyRate: number,
  formatAdherenceRate: number,
): number {
  return clamp(Math.round(consistencyRate * 0.5 + formatAdherenceRate * 0.5), 0, 100);
}

export function computeConsistencyTier(
  score: number,
): AgentOutputConsistencyMetrics['consistencyTier'] {
  if (score >= 80) return 'consistent';
  if (score >= 60) return 'reliable';
  if (score >= 40) return 'variable';
  return 'erratic';
}

type SessionRow = {
  id: string;
  ticketId: string;
  personaType: string;
  status: string;
  outputSummary: string | null;
};

export function buildOutputConsistencyMetrics(
  allSessions: SessionRow[],
): AgentOutputConsistencyMetrics[] {
  // Group sessions by personaType
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const metrics: AgentOutputConsistencyMetrics[] = [];

  for (const [personaType, agentSessionList] of sessionsByPersona.entries()) {
    const totalOutputs = agentSessionList.length;

    // consistentOutputs = completed sessions
    const consistentOutputs = agentSessionList.filter(
      (s) => s.status === 'completed',
    ).length;

    // consistencyRate = completedSessions / totalSessions * 100
    const consistencyRate =
      totalOutputs > 0
        ? Math.round((consistentOutputs / totalOutputs) * 100)
        : 0;

    // formatAdherenceRate = sessions with non-empty outputSummary / totalSessions * 100
    const sessionsWithOutput = agentSessionList.filter(
      (s) => s.outputSummary != null && s.outputSummary.trim() !== '',
    ).length;
    const formatAdherenceRate =
      totalOutputs > 0
        ? Math.round((sessionsWithOutput / totalOutputs) * 100)
        : 0;

    const outputConsistencyScore = computeOutputConsistencyScore(
      consistencyRate,
      formatAdherenceRate,
    );

    const agentName =
      personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' ');

    metrics.push({
      agentId: personaType,
      agentName,
      totalOutputs,
      consistentOutputs,
      consistencyRate,
      formatAdherenceRate,
      outputConsistencyScore,
      consistencyTier: computeConsistencyTier(outputConsistencyScore),
    });
  }

  metrics.sort((a, b) => b.outputConsistencyScore - a.outputConsistencyScore);
  return metrics;
}

export async function analyzeAgentOutputConsistency(
  projectId: string,
): Promise<AgentOutputConsistencyReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        outputSummary: agentSessions.outputSummary,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      agents: [],
      avgConsistencyScore: 0,
      mostConsistentAgent: null,
      leastConsistentAgent: null,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const agents = buildOutputConsistencyMetrics(allSessions);

  const avgConsistencyScore =
    agents.length > 0
      ? Math.round(
          agents.reduce((s, a) => s + a.outputConsistencyScore, 0) / agents.length,
        )
      : 0;

  const mostConsistentAgent = agents.length > 0 ? agents[0].agentName : null;
  const leastConsistentAgent =
    agents.length > 0 ? agents[agents.length - 1].agentName : null;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummaryText = agents
      .slice(0, 8)
      .map(
        (a) =>
          `${a.agentId}: score=${a.outputConsistencyScore}, tier=${a.consistencyTier}, consistencyRate=${a.consistencyRate}%, formatAdherence=${a.formatAdherenceRate}%, totalOutputs=${a.totalOutputs}`,
      )
      .join('\n');

    const prompt = `Analyze the output consistency of AI agents:\n${agentSummaryText}\n\nProject: avgConsistency=${avgConsistencyScore}%, mostConsistent=${mostConsistentAgent}, leastConsistent=${leastConsistentAgent}\n\nProvide:\n1. A summary paragraph about output consistency health\n2. 2-3 specific recommendations\n\nFormat as JSON: {"summary": "...", "recommendations": ["...", "..."]}`;

    const msg = await client.messages.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      try {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
        const parsed = JSON.parse(jsonStr);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Output consistency AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    avgConsistencyScore,
    mostConsistentAgent,
    leastConsistentAgent,
    aiSummary,
    aiRecommendations,
  };
}
