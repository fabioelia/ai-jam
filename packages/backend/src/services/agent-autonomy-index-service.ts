import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentAutonomyMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  directCompletions: number;
  escalatedSessions: number;
  autonomyRate: number;
  avgHandoffsPerSession: number;
  autonomyScore: number;
  autonomyTier: 'highly_autonomous' | 'autonomous' | 'semi_autonomous' | 'dependent';
}

export interface AgentAutonomyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAutonomyScore: number;
    highlyAutonomousAgents: number;
    dependentAgents: number;
    mostAutonomousAgent: string | null;
  };
  agents: AgentAutonomyMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeAutonomyScore(autonomyRate: number, avgHandoffsPerSession: number): number {
  return Math.min(100, Math.max(0, Math.round(
    (autonomyRate * 0.7 + (1 - Math.min(1, avgHandoffsPerSession / 5)) * 0.3) * 100
  )));
}

export function getAutonomyTier(score: number): AgentAutonomyMetrics['autonomyTier'] {
  if (score >= 80) return 'highly_autonomous';
  if (score >= 60) return 'autonomous';
  if (score >= 35) return 'semi_autonomous';
  return 'dependent';
}

export async function analyzeAgentAutonomyIndex(projectId: string): Promise<AgentAutonomyReport> {
  const projectTickets = await db
    .select({ id: tickets.id, assignedPersona: tickets.assignedPersona, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allSessions: { id: string; ticketId: string | null; personaType: string; status: string; handoffTo?: string | null }[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        handoffTo: agentSessions.handoffTo,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgAutonomyScore: 0,
        highlyAutonomousAgents: 0,
        dependentAgents: 0,
        mostAutonomousAgent: null,
      },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  const sessionsByPersona = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const agents: AgentAutonomyMetrics[] = [];

  for (const [personaType, sessions] of sessionsByPersona.entries()) {
    const totalSessions = sessions.length;
    const directCompletions = sessions.filter(s => s.status === 'completed' && (!s.handoffTo || s.handoffTo === '')).length;
    const escalatedSessions = sessions.filter(s => s.handoffTo && s.handoffTo !== '').length;
    const autonomyRate = totalSessions > 0 ? directCompletions / totalSessions : 0;
    const avgHandoffsPerSession = totalSessions > 0 ? escalatedSessions / totalSessions : 0;

    const autonomyScore = computeAutonomyScore(autonomyRate, avgHandoffsPerSession);
    const autonomyTier = getAutonomyTier(autonomyScore);

    agents.push({
      agentId: personaType,
      agentName: personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' '),
      totalSessions,
      directCompletions,
      escalatedSessions,
      autonomyRate: Math.round(autonomyRate * 1000) / 1000,
      avgHandoffsPerSession: Math.round(avgHandoffsPerSession * 100) / 100,
      autonomyScore,
      autonomyTier,
    });
  }

  agents.sort((a, b) => b.autonomyScore - a.autonomyScore);

  const avgAutonomyScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.autonomyScore, 0) / agents.length)
    : 0;
  const highlyAutonomousAgents = agents.filter(a => a.autonomyTier === 'highly_autonomous').length;
  const dependentAgents = agents.filter(a => a.autonomyTier === 'dependent').length;
  const mostAutonomousAgent = agents.length > 0 ? agents[0].agentName : null;

  let insights: string[] = [];
  let recommendations: string[] = [];

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.autonomyScore}, tier=${a.autonomyTier}, rate=${(a.autonomyRate * 100).toFixed(1)}%`
    ).join('\n');

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Analyze agent autonomy:\n${agentSummary}\nProvide JSON: {"insights": ["..."], "recommendations": ["..."]}` }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
      if (Array.isArray(parsed.insights)) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
    }
  } catch {
    insights = ['Autonomy index analysis complete.'];
    recommendations = ['Focus on reducing escalations to improve autonomy scores.'];
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: { totalAgents: agents.length, avgAutonomyScore, highlyAutonomousAgents, dependentAgents, mostAutonomousAgent },
    agents,
    insights,
    recommendations,
  };
}
