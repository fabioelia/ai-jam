import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentCognitiveLoadMetrics {
  personaId: string;
  totalSessions: number;
  avgConcurrentTasks: number;
  contextSwitches: number;
  avgTokenBudget: number;
  complexTaskRatio: number; // tickets with 3+ dependencies / total
  cognitiveLoadScore: number; // 0-100 (higher = more overloaded)
  loadTier: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentCognitiveLoadReport {
  projectId: string;
  agents: AgentCognitiveLoadMetrics[];
  mostOverloadedAgent: string | null;
  leastLoadedAgent: string | null;
  avgCognitiveLoadScore: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Cognitive load analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Review agents with critical cognitive load and redistribute tasks.',
  'Reduce context switches by grouping similar tasks for the same agent.',
];

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

type TicketRow = {
  id: string;
  title: string;
  assignedPersona: string | null;
  status: string;
  createdAt: Date;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeLoadTier(
  score: number,
): AgentCognitiveLoadMetrics['loadTier'] {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

export function computeCognitiveLoadScore(
  avgConcurrentTasks: number,
  contextSwitches: number,
  totalSessions: number,
  avgTokenBudget: number,
  complexTaskRatio: number,
): number {
  const concurrencyScore = clamp(avgConcurrentTasks / 5, 0, 1) * 100;
  const contextSwitchScore =
    totalSessions > 0
      ? clamp(contextSwitches / totalSessions, 0, 1) * 100
      : 0;
  const tokenPressureScore = clamp(avgTokenBudget / 4000, 0, 1) * 100;
  const complexityScore = complexTaskRatio * 100;

  return Math.round(
    concurrencyScore * 0.35 +
      contextSwitchScore * 0.30 +
      tokenPressureScore * 0.20 +
      complexityScore * 0.15,
  );
}

export function buildCognitiveLoadMetrics(
  allSessions: SessionRow[],
  allTickets: TicketRow[],
): AgentCognitiveLoadMetrics[] {
  // Group sessions by personaType
  const sessionsByPersona = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  // Sort all sessions by startedAt for context switch computation
  const allSorted = allSessions
    .filter((s) => s.startedAt != null)
    .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime());

  const metrics: AgentCognitiveLoadMetrics[] = [];

  for (const [personaType, agentSess] of sessionsByPersona.entries()) {
    const totalSessions = agentSess.length;

    // Sort this agent's sessions by startedAt
    const sortedAgentSess = agentSess
      .filter((s) => s.startedAt != null)
      .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime());

    // avgConcurrentTasks: for each session, count in-progress tickets assigned to this persona
    // Proxy: tickets assigned to this persona that were started (createdAt) before the session
    // and not yet completed (status !== 'done') at the session startedAt
    const personaTickets = allTickets.filter((t) => t.assignedPersona === personaType);

    let totalConcurrent = 0;
    for (const session of sortedAgentSess) {
      const sessionStart = new Date(session.startedAt!).getTime();
      // Count tickets that were in progress at session start time
      // Proxy: tickets with createdAt <= sessionStart and status is active
      const concurrentCount = personaTickets.filter((t) => {
        const ticketCreated = new Date(t.createdAt).getTime();
        return ticketCreated <= sessionStart && t.status === 'in_progress';
      }).length;
      totalConcurrent += concurrentCount;
    }
    const avgConcurrentTasks =
      sortedAgentSess.length > 0
        ? totalConcurrent / sortedAgentSess.length
        : 0;

    // contextSwitches: count gaps between consecutive sessions of this persona
    // where another persona had a session in between
    let contextSwitches = 0;
    for (let i = 1; i < sortedAgentSess.length; i++) {
      const prevEnd = sortedAgentSess[i - 1].startedAt!;
      const currStart = sortedAgentSess[i].startedAt!;
      const prevEndMs = new Date(prevEnd).getTime();
      const currStartMs = new Date(currStart).getTime();

      // Check if any OTHER persona had a session that started between these two sessions
      const hasInterleaved = allSorted.some(
        (s) =>
          s.personaType !== personaType &&
          new Date(s.startedAt!).getTime() > prevEndMs &&
          new Date(s.startedAt!).getTime() < currStartMs,
      );
      if (hasInterleaved) {
        contextSwitches++;
      }
    }

    // avgTokenBudget: sum of all ticket title lengths × 10 as proxy
    const avgTokenBudget =
      personaTickets.length > 0
        ? personaTickets.reduce((sum, t) => sum + t.title.length * 10, 0) /
          personaTickets.length
        : 0;

    // complexTaskRatio: no ticketDependencies table, use 0
    const complexTaskRatio = 0;

    const cognitiveLoadScore = computeCognitiveLoadScore(
      avgConcurrentTasks,
      contextSwitches,
      totalSessions,
      avgTokenBudget,
      complexTaskRatio,
    );

    const loadTier = computeLoadTier(cognitiveLoadScore);

    metrics.push({
      personaId: personaType,
      totalSessions,
      avgConcurrentTasks: Math.round(avgConcurrentTasks * 10) / 10,
      contextSwitches,
      avgTokenBudget: Math.round(avgTokenBudget),
      complexTaskRatio,
      cognitiveLoadScore,
      loadTier,
    });
  }

  metrics.sort((a, b) => b.cognitiveLoadScore - a.cognitiveLoadScore);
  return metrics;
}

export async function analyzeAgentCognitiveLoad(
  projectId: string,
): Promise<AgentCognitiveLoadReport> {
  // Fetch all tickets for this project
  const projectTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      agents: [],
      mostOverloadedAgent: null,
      leastLoadedAgent: null,
      avgCognitiveLoadScore: 0,
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const agents = buildCognitiveLoadMetrics(allSessions, projectTickets);

  const mostOverloadedAgent = agents.length > 0 ? agents[0].personaId : null;
  const leastLoadedAgent =
    agents.length > 0 ? agents[agents.length - 1].personaId : null;
  const avgCognitiveLoadScore =
    agents.length > 0
      ? Math.round(
          agents.reduce((sum, a) => sum + a.cognitiveLoadScore, 0) /
            agents.length,
        )
      : 0;

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
          `${a.personaId}: score=${a.cognitiveLoadScore}, tier=${a.loadTier}, avgConcurrent=${a.avgConcurrentTasks}, contextSwitches=${a.contextSwitches}, complexTaskRatio=${a.complexTaskRatio}`,
      )
      .join('\n');

    const prompt = `Analyze the cognitive load of AI agents in this project:\n${agentSummaryText}\n\nOverall avgCognitiveLoadScore=${avgCognitiveLoadScore}\n\nProvide:\n1. A summary paragraph about the team's cognitive load state\n2. 2-3 specific recommendations to reduce cognitive overload\n\nFormat as JSON: {"summary": "...", "recommendations": ["...", "..."]}`;

    const msg = await client.messages.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw =
      msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
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
    console.warn('Cognitive load AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    mostOverloadedAgent,
    leastLoadedAgent,
    avgCognitiveLoadScore,
    aiSummary,
    aiRecommendations,
  };
}
