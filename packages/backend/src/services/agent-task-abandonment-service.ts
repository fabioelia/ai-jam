import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
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

export function computeAbandonmentScore(
  abandonmentRate: number,
  avgAbandonmentPoint: number,
): number {
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

const FALLBACK_SUMMARY = 'Review agent task abandonment patterns to improve reliability.';
const FALLBACK_RECOMMENDATIONS = [
  'Identify tasks with high abandonment rates and simplify them.',
  'Provide better support for agents that frequently abandon tasks.',
  'Monitor agents with volatile tier classification for workload issues.',
];

export async function analyzeAgentTaskAbandonment(projectId: string): Promise<AgentTaskAbandonmentReport> {
  const allSessions = await db
    .select({
      id: agentSessions.id,
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
      handoffTo: agentSessions.handoffTo,
    })
    .from(agentSessions)
    .where(eq(agentSessions.projectId, projectId));

  if (allSessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
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

  const sessionsByPersona = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const agents: AgentTaskAbandonmentData[] = [];

  for (const [personaType, sessions] of sessionsByPersona.entries()) {
    const tasksStarted = sessions.length;
    const tasksCompleted = sessions.filter(s => s.status === 'completed').length;
    const abandonedSessions = sessions.filter(
      s => s.status !== 'completed' && s.status !== 'active' && (!s.handoffTo || s.handoffTo === ''),
    );
    const tasksAbandoned = abandonedSessions.length;
    const abandonmentRate = (tasksAbandoned / Math.max(tasksStarted, 1)) * 100;

    let avgAbandonmentPoint = 50;
    const timedAbandoned = abandonedSessions.filter(s => s.startedAt && s.completedAt);
    if (timedAbandoned.length > 0) {
      const points = timedAbandoned.map(s => {
        const elapsed = new Date(s.completedAt!).getTime() - new Date(s.startedAt!).getTime();
        return Math.min(100, (elapsed / (8 * 3600 * 1000)) * 100);
      });
      avgAbandonmentPoint = points.reduce((a, b) => a + b, 0) / points.length;
    }

    const statusCounts = new Map<string, number>();
    for (const s of abandonedSessions) {
      const k = s.status || 'unknown';
      statusCounts.set(k, (statusCounts.get(k) ?? 0) + 1);
    }
    let topAbandonmentReason = 'complexity';
    let maxCount = 0;
    for (const [status, count] of statusCounts) {
      if (count > maxCount) { maxCount = count; topAbandonmentReason = status; }
    }
    if (topAbandonmentReason === 'failed') topAbandonmentReason = 'error';
    else if (topAbandonmentReason === 'interrupted') topAbandonmentReason = 'interruption';
    else if (topAbandonmentReason === 'unknown' || topAbandonmentReason === '') topAbandonmentReason = 'complexity';

    const abandonmentScore = computeAbandonmentScore(abandonmentRate, avgAbandonmentPoint);
    const abandonmentTier = getAbandonmentTier(abandonmentScore);
    const agentName = personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' ');

    agents.push({
      agentId: personaType,
      agentName,
      tasksStarted,
      tasksAbandoned,
      tasksCompleted,
      abandonmentRate: Math.round(abandonmentRate * 100) / 100,
      avgAbandonmentPoint: Math.round(avgAbandonmentPoint),
      topAbandonmentReason,
      abandonmentScore: Math.round(abandonmentScore * 100) / 100,
      abandonmentTier,
    });
  }

  agents.sort((a, b) => b.abandonmentScore - a.abandonmentScore);

  const totalTasksStarted = agents.reduce((s, a) => s + a.tasksStarted, 0);
  const totalTasksAbandoned = agents.reduce((s, a) => s + a.tasksAbandoned, 0);
  const avgAbandonmentRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.abandonmentRate, 0) / agents.length * 100) / 100
    : 0;
  const mostReliableAgent = agents.length > 0 ? agents[0].agentName : '';
  const mostVolatileAgent = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const lowAbandonmentCount = agents.filter(a => a.abandonmentRate < 20).length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummaryText = agents.slice(0, 8).map(a =>
      `${a.agentName}: abandonmentRate=${a.abandonmentRate}%, score=${a.abandonmentScore}, tier=${a.abandonmentTier}`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Analyze agent task abandonment:\n${agentSummaryText}\n\nProvide JSON: {"summary": "...", "recommendations": ["...", "...", "..."]}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (parsed.summary) aiSummary = parsed.summary;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        aiRecommendations = parsed.recommendations;
      }
    }
  } catch {
    // fallback values already set
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
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
