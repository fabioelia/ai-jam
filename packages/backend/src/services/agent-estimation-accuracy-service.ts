import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentEstimationData {
  agentId: string;
  agentName: string;
  estimationsProvided: number;
  estimationsWithinRange: number;  // estimates within 20% of actual
  avgEstimationError: number;      // % deviation from actual (absolute)
  overestimationRate: number;      // % times predicted > actual * 1.2
  underestimationRate: number;     // % times predicted < actual * 0.8
  estimationBias: 'optimistic' | 'pessimistic' | 'accurate' | 'none';
  estimationScore: number;         // 0-100
  estimationTier: 'precise' | 'reasonable' | 'unreliable' | 'erratic';
}

export interface AgentEstimationAccuracyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgEstimationScore: number;
    mostPreciseAgent: string;    // agentName with highest estimationScore
    mostErraticAgent: string;    // agentName with lowest estimationScore
    accurateEstimationCount: number;  // agents with estimationTier 'precise' or 'reasonable'
  };
  agents: AgentEstimationData[];
  insights: string[];
  recommendations: string[];
}

export function computeEstimationScore(estimationsWithinRange: number, estimationsProvided: number, avgEstimationError: number): number {
  const base = estimationsProvided > 0 ? (estimationsWithinRange / estimationsProvided) * 100 : 50;
  const penalty = Math.min(30, avgEstimationError * 0.3);
  return Math.min(100, Math.max(0, base - penalty));
}

export function getEstimationTier(estimationScore: number): AgentEstimationData['estimationTier'] {
  if (estimationScore >= 75) return 'precise';
  if (estimationScore >= 50) return 'reasonable';
  if (estimationScore >= 25) return 'unreliable';
  return 'erratic';
}

export function getEstimationBias(overestimationRate: number, underestimationRate: number): AgentEstimationData['estimationBias'] {
  if (overestimationRate > underestimationRate + 20) return 'pessimistic';
  if (underestimationRate > overestimationRate + 20) return 'optimistic';
  if (overestimationRate < 30 && underestimationRate < 30) return 'accurate';
  return 'none';
}

export async function analyzeAgentEstimationAccuracy(projectId: string): Promise<AgentEstimationAccuracyReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      storyPoints: tickets.storyPoints,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = allTickets.map(t => t.id);

  let allSessions: { id: string; ticketId: string | null; personaType: string; status: string; startedAt: Date | null; completedAt: Date | null; retryCount: number }[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
        retryCount: agentSessions.retryCount,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allTickets.length === 0) {
    return {
      projectId,
      generatedAt: now.toISOString(),
      summary: { totalAgents: 0, avgEstimationScore: 0, mostPreciseAgent: '', mostErraticAgent: '', accurateEstimationCount: 0 },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  // Compute baseline from done tickets with story points
  const doneTickets = allTickets.filter(t => t.status === 'done' && t.storyPoints != null);
  const totalHours = doneTickets.reduce((s, t) => {
    const h = Math.max(0, (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
    return s + h;
  }, 0);
  const totalPoints = doneTickets.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
  const baselineHoursPerPoint = totalPoints > 0 ? totalHours / totalPoints : 1;

  // Build a map: ticketId -> storyPoints
  const ticketPointsMap = new Map<string, number>();
  for (const t of allTickets) {
    if (t.storyPoints != null) ticketPointsMap.set(t.id, t.storyPoints);
  }

  // Group sessions by personaType
  const sessionsByAgent = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    if (!s.personaType) continue;
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  if (sessionsByAgent.size === 0) {
    return {
      projectId,
      generatedAt: now.toISOString(),
      summary: { totalAgents: 0, avgEstimationScore: 0, mostPreciseAgent: '', mostErraticAgent: '', accurateEstimationCount: 0 },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  const agents: AgentEstimationData[] = [];

  for (const [personaType, sessions] of sessionsByAgent.entries()) {
    // estimationsProvided = sessions where startedAt is not null
    const providedSessions = sessions.filter(s => s.startedAt !== null);
    const estimationsProvided = providedSessions.length;

    // For sessions with both startedAt and completedAt
    const completedSessions = providedSessions.filter(s => s.completedAt !== null);

    let withinRange = 0;
    let totalError = 0;
    let overCount = 0;
    let underCount = 0;

    for (const s of completedSessions) {
      const points = s.ticketId ? (ticketPointsMap.get(s.ticketId) ?? 1) : 1;
      const estimated = points * baselineHoursPerPoint;
      const actual = Math.max(0, (s.completedAt!.getTime() - s.startedAt!.getTime()) / (1000 * 60 * 60));

      const error = Math.abs(actual - estimated) / Math.max(1, estimated);
      totalError += error;

      if (error <= 0.2) withinRange++;
      if (actual > estimated * 1.2) overCount++;
      if (actual < estimated * 0.8) underCount++;
    }

    const estimationsWithinRange = withinRange;
    const avgEstimationError = completedSessions.length > 0 ? (totalError / completedSessions.length) * 100 : 0;
    const overestimationRate = estimationsProvided > 0 ? (overCount / estimationsProvided) * 100 : 0;
    const underestimationRate = estimationsProvided > 0 ? (underCount / estimationsProvided) * 100 : 0;

    const estimationScore = Math.round(computeEstimationScore(estimationsWithinRange, estimationsProvided, avgEstimationError));
    const estimationTier = getEstimationTier(estimationScore);
    const estimationBias = getEstimationBias(overestimationRate, underestimationRate);

    agents.push({
      agentId: personaType,
      agentName: personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' '),
      estimationsProvided,
      estimationsWithinRange,
      avgEstimationError: Math.round(avgEstimationError * 10) / 10,
      overestimationRate: Math.round(overestimationRate * 10) / 10,
      underestimationRate: Math.round(underestimationRate * 10) / 10,
      estimationBias,
      estimationScore,
      estimationTier,
    });
  }

  agents.sort((a, b) => b.estimationScore - a.estimationScore);

  const avgEstimationScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.estimationScore, 0) / agents.length)
    : 0;
  const mostPreciseAgent = agents.length > 0 ? agents[0].agentName : '';
  const mostErraticAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const accurateEstimationCount = agents.filter(a => a.estimationTier === 'precise' || a.estimationTier === 'reasonable').length;

  let insights: string[] = [];
  let recommendations: string[] = [];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.estimationScore}, tier=${a.estimationTier}, bias=${a.estimationBias}, error=${a.avgEstimationError}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: `Analyze agent estimation accuracy data and provide 3 insights and 3 recommendations. Output JSON: {"insights": ["...", "...", "..."], "recommendations": ["...", "...", "..."]}\n\n${agentSummary}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (Array.isArray(parsed.insights)) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
    }
  } catch (e) {
    console.warn('Agent estimation accuracy AI failed, using fallback:', e);
    insights = [];
    recommendations = [];
  }

  return {
    projectId,
    generatedAt: now.toISOString(),
    summary: { totalAgents: agents.length, avgEstimationScore, mostPreciseAgent, mostErraticAgent, accurateEstimationCount },
    agents,
    insights,
    recommendations,
  };
}
