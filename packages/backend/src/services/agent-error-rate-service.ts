import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentErrorMetrics {
  agentPersona: string;
  totalTasks: number;
  failedTasks: number;
  retriedTasks: number;
  errorRate: number;
  retryRate: number;
  reliabilityScore: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  recommendedAction: string;
}

export interface ErrorRateSummary {
  totalAgents: number;
  avgErrorRate: number;
  highRiskAgents: number;
  mostReliableAgent: string | null;
}

export interface AgentErrorRateReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentErrorMetrics[];
  summary: ErrorRateSummary;
  aiSummary: string;
}

const FALLBACK_AI_SUMMARY = 'Review agent error rates to identify reliability issues and reduce failure patterns.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function classifySeverity(errorRate: number): 'critical' | 'high' | 'moderate' | 'low' {
  if (errorRate >= 0.3) return 'critical';
  if (errorRate >= 0.15) return 'high';
  if (errorRate >= 0.05) return 'moderate';
  return 'low';
}

function recommendedAction(severity: 'critical' | 'high' | 'moderate' | 'low'): string {
  switch (severity) {
    case 'critical': return 'Immediate review required — pause new assignments and audit recent failures';
    case 'high': return 'Investigate failure patterns and reduce concurrent task load';
    case 'moderate': return 'Monitor closely and identify recurring error causes';
    case 'low': return 'No action required — maintain current reliability';
  }
}

export async function analyzeAgentErrorRates(projectId: string): Promise<AgentErrorRateReport> {
  const now = new Date();
  const oneHour = 60 * 60 * 1000;

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
      ),
    );

  type AgentData = { all: typeof allTickets; failed: typeof allTickets; retried: typeof allTickets };
  const agentMap = new Map<string, AgentData>();

  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, { all: [], failed: [], retried: [] });
    const entry = agentMap.get(persona)!;
    entry.all.push(t);
    if (t.status === 'cancelled') {
      entry.failed.push(t);
    }
    // Retried heuristic: in_progress tickets where updatedAt > createdAt + 1hr (reset indicator)
    if (t.status === 'in_progress' && t.updatedAt.getTime() - t.createdAt.getTime() > oneHour) {
      entry.retried.push(t);
    }
  }

  if (agentMap.size === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgents: 0, avgErrorRate: 0, highRiskAgents: 0, mostReliableAgent: null },
      aiSummary: FALLBACK_AI_SUMMARY,
    };
  }

  const rawAgents: AgentErrorMetrics[] = [...agentMap.entries()].map(([persona, d]) => {
    const totalTasks = d.all.length;
    const failedTasks = d.failed.length;
    const retriedTasks = d.retried.length;
    const errorRate = totalTasks > 0 ? failedTasks / totalTasks : 0;
    const retryRate = totalTasks > 0 ? retriedTasks / totalTasks : 0;
    const reliabilityScore = Math.round(Math.max(0, 100 - (errorRate * 60 + retryRate * 40)));
    const severity = classifySeverity(errorRate);
    return {
      agentPersona: persona,
      totalTasks,
      failedTasks,
      retriedTasks,
      errorRate: Math.round(errorRate * 1000) / 1000,
      retryRate: Math.round(retryRate * 1000) / 1000,
      reliabilityScore,
      severity,
      recommendedAction: recommendedAction(severity),
    };
  });

  // Sort: errorRate desc, then totalTasks desc
  rawAgents.sort((a, b) => {
    const diff = b.errorRate - a.errorRate;
    if (Math.abs(diff) > 0.0001) return diff;
    return b.totalTasks - a.totalTasks;
  });

  const totalAgents = rawAgents.length;
  const avgErrorRate = totalAgents > 0
    ? Math.round((rawAgents.reduce((s, a) => s + a.errorRate, 0) / totalAgents) * 1000) / 1000
    : 0;
  const highRiskAgents = rawAgents.filter(a => a.errorRate >= 0.15).length;
  const mostReliable = rawAgents.reduce((best, a) =>
    a.reliabilityScore > best.reliabilityScore ? a : best, rawAgents[0]);
  const mostReliableAgent = mostReliable?.agentPersona ?? null;

  const summary: ErrorRateSummary = { totalAgents, avgErrorRate, highRiskAgents, mostReliableAgent };

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_AI_SUMMARY;

  try {
    const statsData = JSON.stringify(rawAgents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      errorRate: a.errorRate,
      retryRate: a.retryRate,
      reliabilityScore: a.reliabilityScore,
      severity: a.severity,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent error patterns for project. Focus on: which agents have highest error rates, common failure modes, whether high retry rates indicate complexity vs reliability issues, actionable recommendations to reduce failures. Give a 2-sentence summary. Output JSON: {summary: string}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonStr = extractJSONFromText(text);
    const parsed = JSON.parse(jsonStr) as { summary: string };
    if (parsed.summary) aiSummary = parsed.summary;
  } catch (e) {
    console.warn('Agent error rate AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents: rawAgents,
    summary,
    aiSummary,
  };
}
