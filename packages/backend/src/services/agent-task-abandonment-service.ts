import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentTaskAbandonmentData {
  agentId: string;
  agentName: string;
  tasksStarted: number;
  tasksAbandoned: number;
  tasksCompleted: number;
  abandonmentRate: number;
  avgAbandonmentPoint: number;
  topAbandonmentReason: string;
  abandonmentScore: number;
  abandonmentTier: 'reliable' | 'moderate' | 'inconsistent' | 'volatile';
}

export interface AgentTaskAbandonmentReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalTasksStarted: number;
    totalTasksAbandoned: number;
    avgAbandonmentRate: number;
    mostReliableAgent: string;
    mostVolatileAgent: string;
    lowAbandonmentCount: number;
  };
  agents: AgentTaskAbandonmentData[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeAbandonmentScore(abandonmentRate: number, avgAbandonmentPoint: number): number {
  let base = (1 - abandonmentRate / 100) * 100;
  if (avgAbandonmentPoint > 75) base += 5;
  if (avgAbandonmentPoint < 25) base -= 10;
  return Math.min(100, Math.max(0, base));
}

export function getAbandonmentTier(abandonmentScore: number): AgentTaskAbandonmentData['abandonmentTier'] {
  if (abandonmentScore >= 80) return 'reliable';
  if (abandonmentScore >= 60) return 'moderate';
  if (abandonmentScore >= 40) return 'inconsistent';
  return 'volatile';
}

const FALLBACK_SUMMARY = 'Review agent task abandonment patterns to identify reliability issues.';
const FALLBACK_RECOMMENDATIONS = [
  'Monitor agents with high abandonment rates',
  'Review task assignment complexity',
  'Improve agent handoff processes',
];

export async function analyzeAgentTaskAbandonment(projectId: string): Promise<AgentTaskAbandonmentReport> {
  const now = new Date();

  // Get tickets for the project to find relevant sessions
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);

  let sessions: {
    id: string;
    ticketId: string | null;
    personaType: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
  }[] = [];

  if (ticketIds.length > 0) {
    sessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        createdAt: agentSessions.createdAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (sessions.length === 0) {
    return {
      projectId,
      generatedAt: now.toISOString(),
      summary: {
        totalTasksStarted: 0,
        totalTasksAbandoned: 0,
        avgAbandonmentRate: 0,
        mostReliableAgent: '',
        mostVolatileAgent: '',
        lowAbandonmentCount: 0,
      },
      agents: [],
      aiSummary: FALLBACK_SUMMARY,
      aiRecommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Group by persona
  const sessionsByPersona = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.personaType;
    const list = sessionsByPersona.get(key) ?? [];
    list.push(s);
    sessionsByPersona.set(key, list);
  }

  // Compute average session duration for abandoned sessions (proxy for avgAbandonmentPoint)
  const allDurations = sessions
    .filter(s => s.completedAt)
    .map(s => s.completedAt!.getTime() - s.createdAt.getTime());
  const avgDuration = allDurations.length > 0
    ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
    : 0;

  const agents: AgentTaskAbandonmentData[] = [];

  for (const [persona, personaSessions] of sessionsByPersona.entries()) {
    const tasksStarted = personaSessions.length;
    const tasksAbandoned = personaSessions.filter(s => s.status === 'cancelled' || s.status === 'failed').length;
    const tasksCompleted = personaSessions.filter(s => s.status === 'completed').length;
    const abandonmentRate = tasksStarted > 0 ? (tasksAbandoned / tasksStarted) * 100 : 0;

    // Compute avgAbandonmentPoint
    const abandonedSessions = personaSessions.filter(s => (s.status === 'cancelled' || s.status === 'failed') && s.completedAt);
    let avgAbandonmentPoint = 50;
    if (abandonedSessions.length > 0 && avgDuration > 0) {
      const fractions = abandonedSessions.map(s => {
        const duration = s.completedAt!.getTime() - s.createdAt.getTime();
        return Math.min(100, (duration / avgDuration) * 100);
      });
      avgAbandonmentPoint = fractions.reduce((a, b) => a + b, 0) / fractions.length;
    }

    const topAbandonmentReason = 'task_complexity';
    const abandonmentScore = computeAbandonmentScore(abandonmentRate, avgAbandonmentPoint);
    const abandonmentTier = getAbandonmentTier(abandonmentScore);

    agents.push({
      agentId: persona,
      agentName: persona.charAt(0).toUpperCase() + persona.slice(1).replace(/_/g, ' '),
      tasksStarted,
      tasksAbandoned,
      tasksCompleted,
      abandonmentRate,
      avgAbandonmentPoint,
      topAbandonmentReason,
      abandonmentScore,
      abandonmentTier,
    });
  }

  const totalTasksStarted = agents.reduce((s, a) => s + a.tasksStarted, 0);
  const totalTasksAbandoned = agents.reduce((s, a) => s + a.tasksAbandoned, 0);
  const avgAbandonmentRate = agents.length > 0
    ? agents.reduce((s, a) => s + a.abandonmentRate, 0) / agents.length
    : 0;

  agents.sort((a, b) => a.abandonmentRate - b.abandonmentRate);
  const mostReliableAgent = agents.length > 0 ? agents[0].agentName : '';
  const mostVolatileAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const lowAbandonmentCount = agents.filter(a => a.abandonmentRate < 20).length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentLines = agents.slice(0, 5).map(a =>
      `${a.agentName}: abandonmentRate=${a.abandonmentRate.toFixed(1)}%, tier=${a.abandonmentTier}`
    ).join('\n');

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent task abandonment patterns. Provide JSON: {"aiSummary": "...", "aiRecommendations": ["...", "...", "..."]}\n\nAgents:\n${agentLines}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1].trim() : text;
      const parsed = JSON.parse(jsonStr);
      if (parsed.aiSummary) aiSummary = parsed.aiSummary;
      if (Array.isArray(parsed.aiRecommendations)) aiRecommendations = parsed.aiRecommendations;
    }
  } catch (e) {
    console.warn('Task abandonment AI failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: now.toISOString(),
    summary: {
      totalTasksStarted,
      totalTasksAbandoned,
      avgAbandonmentRate,
      mostReliableAgent,
      mostVolatileAgent,
      lowAbandonmentCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
