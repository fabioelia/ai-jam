import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentPriorityAlignmentData {
  agentId: string;
  agentName: string;
  criticalResolutionRate: number;
  highPriorityFocusRate: number;
  avgCriticalTimeHours: number;
  avgLowTimeHours: number;
  priorityAlignmentScore: number;
  alignmentTier: 'aligned' | 'balanced' | 'inconsistent' | 'misaligned';
}

export interface PriorityAlignmentReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAlignmentScore: number;
    mostAligned: string;
    leastAligned: string;
    criticalBacklogCount: number;
  };
  agents: AgentPriorityAlignmentData[];
  insights: string[];
  recommendations: string[];
}

export function computePriorityWeightedScore(
  criticalResolutionRate: number,
  highPriorityFocusRate: number,
  avgCriticalTimeHours: number,
  avgLowTimeHours: number,
): number {
  const hasTimeData = avgCriticalTimeHours > 0 || avgLowTimeHours > 0;
  const speedRatio = hasTimeData
    ? (avgLowTimeHours > 0 ? Math.min(avgCriticalTimeHours / avgLowTimeHours, 4) / 4 : 0.5)
    : 0;
  const speedWeight = hasTimeData ? 0.25 : 0;
  const rateWeight = hasTimeData ? 1.0 : 1.0 / 0.75; // normalize when no speed data
  const raw = hasTimeData
    ? (criticalResolutionRate * 0.40) + (highPriorityFocusRate * 0.35) + ((1 - speedRatio) * 100 * speedWeight)
    : (criticalResolutionRate * 0.40) + (highPriorityFocusRate * 0.35);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function getPriorityAlignmentTier(score: number): AgentPriorityAlignmentData['alignmentTier'] {
  if (score >= 75) return 'aligned';
  if (score >= 50) return 'balanced';
  if (score >= 25) return 'inconsistent';
  return 'misaligned';
}

const FALLBACK_INSIGHTS = ['Priority alignment analysis complete.'];
const FALLBACK_RECOMMENDATIONS = ['Focus on resolving critical tickets first to improve alignment scores.'];

export async function analyzeAgentPriorityAlignment(projectId: string): Promise<PriorityAlignmentReport> {
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allSessions: { id: string; ticketId: string | null; personaType: string; status: string; startedAt: Date | null; completedAt: Date | null }[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const criticalBacklogCount = projectTickets.filter(
    t => (t.priority === 'critical') && t.status !== 'done' && t.status !== 'acceptance',
  ).length;

  if (projectTickets.length === 0 || allSessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgAlignmentScore: 0,
        mostAligned: '',
        leastAligned: '',
        criticalBacklogCount,
      },
      agents: [],
      insights: FALLBACK_INSIGHTS,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Build ticket map
  const ticketMap = new Map(projectTickets.map(t => [t.id, t]));

  // Group sessions by persona
  const sessionsByPersona = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    const list = sessionsByPersona.get(s.personaType) ?? [];
    list.push(s);
    sessionsByPersona.set(s.personaType, list);
  }

  const agents: AgentPriorityAlignmentData[] = [];

  for (const [personaType, sessions] of sessionsByPersona.entries()) {
    const ticketsForAgent = projectTickets.filter(t => t.assignedPersona === personaType);
    const totalTickets = ticketsForAgent.length;

    const criticalTickets = ticketsForAgent.filter(t => t.priority === 'critical');
    const criticalResolved = criticalTickets.filter(t => t.status === 'done' || t.status === 'acceptance').length;
    const criticalResolutionRate = criticalTickets.length > 0 ? (criticalResolved / criticalTickets.length) * 100 : 0;

    const highOrCritical = ticketsForAgent.filter(t => t.priority === 'critical' || t.priority === 'high').length;
    const highPriorityFocusRate = totalTickets > 0 ? (highOrCritical / totalTickets) * 100 : 0;

    // Compute avg session durations for critical vs low tickets
    const completedSessions = sessions.filter(s => s.status === 'completed' && s.startedAt && s.completedAt);
    const criticalSessionHours: number[] = [];
    const lowSessionHours: number[] = [];

    for (const s of completedSessions) {
      const ticket = ticketMap.get(s.ticketId ?? '');
      if (!ticket) continue;
      const hours = (new Date(s.completedAt!).getTime() - new Date(s.startedAt!).getTime()) / (1000 * 60 * 60);
      if (ticket.priority === 'critical') criticalSessionHours.push(hours);
      if (ticket.priority === 'low') lowSessionHours.push(hours);
    }

    const avgCriticalTimeHours = criticalSessionHours.length > 0
      ? criticalSessionHours.reduce((a, b) => a + b, 0) / criticalSessionHours.length
      : 0;
    const avgLowTimeHours = lowSessionHours.length > 0
      ? lowSessionHours.reduce((a, b) => a + b, 0) / lowSessionHours.length
      : 0;

    const priorityAlignmentScore = computePriorityWeightedScore(
      criticalResolutionRate,
      highPriorityFocusRate,
      avgCriticalTimeHours,
      avgLowTimeHours,
    );

    agents.push({
      agentId: personaType,
      agentName: personaType.charAt(0).toUpperCase() + personaType.slice(1).replace(/_/g, ' '),
      criticalResolutionRate: Math.round(criticalResolutionRate * 100) / 100,
      highPriorityFocusRate: Math.round(highPriorityFocusRate * 100) / 100,
      avgCriticalTimeHours: Math.round(avgCriticalTimeHours * 10) / 10,
      avgLowTimeHours: Math.round(avgLowTimeHours * 10) / 10,
      priorityAlignmentScore,
      alignmentTier: getPriorityAlignmentTier(priorityAlignmentScore),
    });
  }

  agents.sort((a, b) => b.priorityAlignmentScore - a.priorityAlignmentScore);

  const avgAlignmentScore = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.priorityAlignmentScore, 0) / agents.length)
    : 0;
  const mostAligned = agents.length > 0 ? agents[0].agentName : '';
  const leastAligned = agents.length > 0 ? agents[agents.length - 1].agentName : '';

  let insights = FALLBACK_INSIGHTS;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: { 'HTTP-Referer': 'https://ai-jam.app', 'X-Title': 'AI Jam' },
    });

    const agentSummary = agents.slice(0, 8).map(a =>
      `${a.agentName}: score=${a.priorityAlignmentScore}, tier=${a.alignmentTier}, critRate=${a.criticalResolutionRate}%, highFocus=${a.highPriorityFocusRate}%`
    ).join('\n');

    const prompt = `Analyze AI agent priority alignment:\n${agentSummary}\n\nProvide JSON: {"insights": ["...", "..."], "recommendations": ["...", "..."]}`;

    const msg = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    if (raw) {
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.insights) && parsed.insights.length > 0) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations = parsed.recommendations;
    }
  } catch {
    // fallback
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgAlignmentScore,
      mostAligned,
      leastAligned,
      criticalBacklogCount,
    },
    agents,
    insights,
    recommendations,
  };
}
