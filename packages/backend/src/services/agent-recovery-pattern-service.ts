import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface RecoveryEvent {
  ticketId: string;
  agentPersona: string;
  status: string;
  recoveryMethod: 'self' | 'handoff' | 'escalation' | 'unresolved';
  cycleTimeHours: number;
}

export interface AgentRecoveryProfile {
  agentPersona: string;
  totalFailureEvents: number;
  recoveredCount: number;
  failedToRecover: number;
  recoveryRate: number;
  avgRecoveryTimeHours: number;
  selfRecoveryRate: number;
}

export interface RecoveryPatternReport {
  projectId: string;
  analyzedAt: string;
  totalFailureEvents: number;
  overallRecoveryRate: number;
  avgRecoveryTimeHours: number;
  agentProfiles: AgentRecoveryProfile[];
  recentEvents: RecoveryEvent[];
  aiInsights: string;
  recommendations: string[];
}

const FALLBACK_INSIGHTS = 'Analyze recovery patterns to understand how agents handle failure events and improve resilience.';
const FALLBACK_RECOMMENDATIONS = ['Track recovery time metrics and establish SLAs for failure resolution.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

export async function analyzeRecoveryPatterns(projectId: string): Promise<RecoveryPatternReport> {
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

  // Failure proxy: tickets with status 'review' (went back from done/qa)
  const failureTickets = allTickets.filter(t => t.status === 'review');

  if (failureTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalFailureEvents: 0,
      overallRecoveryRate: 0,
      avgRecoveryTimeHours: 0,
      agentProfiles: [],
      recentEvents: [],
      aiInsights: FALLBACK_INSIGHTS,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const agentMap = new Map<string, { total: number; recovered: number; selfRecovered: number; totalTime: number }>();

  const allEvents: RecoveryEvent[] = failureTickets.map(t => {
    const cycleTimeHours = Math.max(0, (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
    // Heuristic: if cycle time < 24h = self recovery, else = unresolved
    const recoveryMethod: 'self' | 'unresolved' = cycleTimeHours < 24 ? 'self' : 'unresolved';
    const recovered = recoveryMethod === 'self';
    const persona = t.assignedPersona!;

    if (!agentMap.has(persona)) agentMap.set(persona, { total: 0, recovered: 0, selfRecovered: 0, totalTime: 0 });
    const entry = agentMap.get(persona)!;
    entry.total++;
    entry.totalTime += cycleTimeHours;
    if (recovered) { entry.recovered++; entry.selfRecovered++; }

    return {
      ticketId: t.id,
      agentPersona: persona,
      status: t.status,
      recoveryMethod,
      cycleTimeHours: Math.round(cycleTimeHours * 10) / 10,
    };
  });

  // Sort events by updatedAt desc, take last 10
  const sortedTickets = [...failureTickets].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const recentEvents = sortedTickets.slice(0, 10).map(t => {
    const cycleTimeHours = Math.max(0, (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
    const recoveryMethod: 'self' | 'unresolved' = cycleTimeHours < 24 ? 'self' : 'unresolved';
    return {
      ticketId: t.id,
      agentPersona: t.assignedPersona!,
      status: t.status,
      recoveryMethod,
      cycleTimeHours: Math.round(cycleTimeHours * 10) / 10,
    };
  });

  const agentProfiles: AgentRecoveryProfile[] = [...agentMap.entries()].map(([persona, data]) => ({
    agentPersona: persona,
    totalFailureEvents: data.total,
    recoveredCount: data.recovered,
    failedToRecover: data.total - data.recovered,
    recoveryRate: Math.round((data.recovered / Math.max(1, data.total)) * 1000) / 1000,
    avgRecoveryTimeHours: Math.round((data.totalTime / Math.max(1, data.total)) * 10) / 10,
    selfRecoveryRate: Math.round((data.selfRecovered / Math.max(1, data.total)) * 1000) / 1000,
  }));

  const totalFailureEvents = failureTickets.length;
  const totalRecovered = agentProfiles.reduce((s, a) => s + a.recoveredCount, 0);
  const overallRecoveryRate = Math.round((totalRecovered / Math.max(1, totalFailureEvents)) * 1000) / 1000;
  const avgRecoveryTimeHours = agentProfiles.length > 0
    ? Math.round(agentProfiles.reduce((s, a) => s + a.avgRecoveryTimeHours, 0) / agentProfiles.length * 10) / 10
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiInsights = FALLBACK_INSIGHTS;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify({ totalFailureEvents, overallRecoveryRate, agentProfiles: agentProfiles.slice(0, 5) });
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent recovery patterns. Give 2-sentence summary and 2-3 recommendations. Output JSON: {aiInsights: string, recommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiInsights: string; recommendations: string[] };
    if (parsed.aiInsights) aiInsights = parsed.aiInsights;
    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations = parsed.recommendations;
  } catch (e) {
    console.warn('Agent recovery pattern AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalFailureEvents,
    overallRecoveryRate,
    avgRecoveryTimeHours,
    agentProfiles,
    recentEvents,
    aiInsights,
    recommendations,
  };
}
