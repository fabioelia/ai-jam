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
  classification: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentErrorRateReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentErrorMetrics[];
  criticalCount: number;
  avgReliabilityScore: number;
  mostReliableAgent: string | null;
  leastReliableAgent: string | null;
  aiSummary: string;
  recommendations: string[];
}

const FALLBACK_SUMMARY = 'Review agent error patterns to identify reliability issues and improve task completion rates.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function classify(errorRate: number): 'critical' | 'high' | 'moderate' | 'low' {
  if (errorRate >= 0.3) return 'critical';
  if (errorRate >= 0.15) return 'high';
  if (errorRate >= 0.05) return 'moderate';
  return 'low';
}


export async function analyzeAgentErrorRates(projectId: string): Promise<AgentErrorRateReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
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
      criticalCount: 0,
      avgReliabilityScore: 0,
      mostReliableAgent: null,
      leastReliableAgent: null,
      aiSummary: FALLBACK_SUMMARY,
      recommendations: [],
    };
  }

  // Proxy: 'review' status = failed/cancelled task (rejected, sent back)
  const FAILED_STATUS = 'review';

  const agentMap = new Map<string, { total: number; failed: number; retried: number }>();
  for (const t of allTickets) {
    const persona = t.assignedPersona;
    if (!persona) continue;
    if (!agentMap.has(persona)) agentMap.set(persona, { total: 0, failed: 0, retried: 0 });
    const entry = agentMap.get(persona)!;
    entry.total++;
    if (t.status === FAILED_STATUS) entry.failed++;
    // Retried: in_progress tickets where updatedAt > createdAt + 1hr (3600000ms)
    if (t.status === 'in_progress' && t.createdAt && t.updatedAt) {
      const createdMs = new Date(t.createdAt).getTime();
      const updatedMs = new Date(t.updatedAt).getTime();
      if (updatedMs > createdMs + 3600000) entry.retried++;
    }
  }

  const rawAgents: AgentErrorMetrics[] = [];
  for (const [persona, data] of agentMap.entries()) {
    const errorRate = data.failed / Math.max(1, data.total);
    const retryRate = data.retried / Math.max(1, data.total);
    const reliabilityScore = Math.max(0, 100 - (errorRate * 60 + retryRate * 40));
    rawAgents.push({
      agentPersona: persona,
      totalTasks: data.total,
      failedTasks: data.failed,
      retriedTasks: data.retried,
      errorRate: Math.round(errorRate * 1000) / 1000,
      retryRate: Math.round(retryRate * 1000) / 1000,
      reliabilityScore: Math.round(reliabilityScore * 10) / 10,
      classification: classify(errorRate),
    });
  }

  rawAgents.sort((a, b) => {
    const diff = b.errorRate - a.errorRate;
    if (diff !== 0) return diff;
    return b.totalTasks - a.totalTasks;
  });

  const criticalCount = rawAgents.filter(a => a.classification === 'critical').length;
  const avgReliabilityScore = rawAgents.length > 0
    ? Math.round(rawAgents.reduce((s, a) => s + a.reliabilityScore, 0) / rawAgents.length * 10) / 10
    : 0;
  const sorted = [...rawAgents].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const mostReliableAgent = sorted.length > 0 ? sorted[0].agentPersona : null;
  const leastReliableAgent = sorted.length > 1 ? sorted[sorted.length - 1].agentPersona : null;
  const recommendations: string[] = rawAgents
    .filter(a => a.classification === 'critical' || a.classification === 'high')
    .map(a => `${a.agentPersona}: ${a.classification} error rate (${(a.errorRate * 100).toFixed(0)}%) — review recent failures`);

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;

  try {
    const statsData = JSON.stringify(rawAgents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      errorRate: a.errorRate,
      reliabilityScore: a.reliabilityScore,
      classification: a.classification,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent error rates. Give 2-sentence summary. Output JSON: {aiSummary: string}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
  } catch (e) {
    console.warn('Agent error rate AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents: rawAgents,
    criticalCount,
    avgReliabilityScore,
    mostReliableAgent,
    leastReliableAgent,
    aiSummary,
    recommendations,
  };
}
