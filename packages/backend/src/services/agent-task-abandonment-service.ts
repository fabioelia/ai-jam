import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentAbandonmentMetrics {
  agentPersona: string;
  totalTasks: number;
  abandonedTasks: number;
  completedTasks: number;
  abandonmentRate: number;
  completionRate: number;
  avgStuckDuration: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface AgentAbandonmentReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentAbandonmentMetrics[];
  summary: {
    totalAgents: number;
    avgAbandonmentRate: number;
    highRiskAgents: number;
    mostReliableAgent: string | null;
  };
  aiSummary: string;
}

const TWO_HOURS_MS = 7200000;
const FALLBACK_SUMMARY = 'Review agent task abandonment patterns to identify capacity and complexity mismatches.';

function getRiskLevel(rate: number): AgentAbandonmentMetrics['riskLevel'] {
  if (rate >= 0.4) return 'critical';
  if (rate >= 0.25) return 'high';
  if (rate >= 0.1) return 'moderate';
  return 'low';
}

function getRecommendation(riskLevel: AgentAbandonmentMetrics['riskLevel']): string {
  switch (riskLevel) {
    case 'critical': return 'Immediate intervention — agent consistently abandoning tasks';
    case 'high': return 'Review task complexity and agent capacity';
    case 'moderate': return 'Monitor for patterns and adjust task assignment';
    case 'low': return 'Performing within acceptable bounds';
  }
}

export async function analyzeAgentTaskAbandonment(projectId: string): Promise<AgentAbandonmentReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgents: 0, avgAbandonmentRate: 0, highRiskAgents: 0, mostReliableAgent: null },
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const agentMap = new Map<string, { total: number; abandoned: number; completed: number; stuckDurations: number[] }>();

  for (const t of allTickets) {
    if (!t.assignedPersona) continue;
    const persona = t.assignedPersona;
    if (!agentMap.has(persona)) agentMap.set(persona, { total: 0, abandoned: 0, completed: 0, stuckDurations: [] });
    const entry = agentMap.get(persona)!;
    entry.total++;

    if (t.status === 'done') {
      entry.completed++;
    }

    if (t.status === 'in_progress') {
      const elapsed = t.updatedAt.getTime() - t.createdAt.getTime();
      if (elapsed > TWO_HOURS_MS) {
        entry.abandoned++;
        entry.stuckDurations.push(elapsed / 3600000);
      }
    }
  }

  if (agentMap.size === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgents: 0, avgAbandonmentRate: 0, highRiskAgents: 0, mostReliableAgent: null },
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const agents: AgentAbandonmentMetrics[] = [];
  for (const [agentPersona, { total, abandoned, completed, stuckDurations }] of agentMap.entries()) {
    const abandonmentRate = parseFloat((abandoned / total).toFixed(3));
    const completionRate = parseFloat((completed / total).toFixed(3));
    const avgStuckDuration =
      stuckDurations.length > 0
        ? parseFloat((stuckDurations.reduce((a, b) => a + b, 0) / stuckDurations.length).toFixed(1))
        : 0;
    const riskLevel = getRiskLevel(abandonmentRate);
    agents.push({
      agentPersona,
      totalTasks: total,
      abandonedTasks: abandoned,
      completedTasks: completed,
      abandonmentRate,
      completionRate,
      avgStuckDuration,
      riskLevel,
      recommendation: getRecommendation(riskLevel),
    });
  }

  agents.sort((a, b) =>
    b.abandonmentRate !== a.abandonmentRate
      ? b.abandonmentRate - a.abandonmentRate
      : b.totalTasks - a.totalTasks,
  );

  const totalAgents = agents.length;
  const avgAbandonmentRate =
    totalAgents > 0
      ? parseFloat((agents.reduce((s, a) => s + a.abandonmentRate, 0) / totalAgents).toFixed(3))
      : 0;
  const highRiskAgents = agents.filter((a) => a.abandonmentRate >= 0.25).length;
  const reliableAgents = agents.filter((a) => a.totalTasks >= 2);
  const mostReliableAgent =
    reliableAgents.length > 0
      ? reliableAgents.reduce((best, a) => (a.abandonmentRate < best.abandonmentRate ? a : best)).agentPersona
      : null;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const agentLines = agents
      .slice(0, 5)
      .map(
        (a) =>
          `${a.agentPersona}: abandonmentRate=${a.abandonmentRate}, riskLevel=${a.riskLevel}, avgStuck=${a.avgStuckDuration}h`,
      )
      .join('\n');
    const prompt = `Analyze AI agent task abandonment patterns for a software project. Focus on: which agents are struggling to complete in-progress tasks, whether high abandonment rates suggest task complexity or agent capacity issues, and actionable recommendations to reduce abandonment.\n\nAgents:\n${agentLines}\n\nSummary: avgAbandonmentRate=${avgAbandonmentRate}, highRiskAgents=${highRiskAgents}/${totalAgents}`;
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Task abandonment AI summary failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents,
    summary: { totalAgents, avgAbandonmentRate, highRiskAgents, mostReliableAgent },
    aiSummary,
  };
}
