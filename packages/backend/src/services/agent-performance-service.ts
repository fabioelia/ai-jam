import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentMetrics {
  agentName: string;
  completedTickets: number;
  inProgressTickets: number;
  totalStoryPointsDelivered: number;
  avgStoryPointsPerTicket: number;
  completionRate: number;
  topTicketTypes: string[];
  performanceTier: 'high' | 'medium' | 'low';
}

export interface AgentPerformanceReport {
  projectId: string;
  agents: AgentMetrics[];
  topPerformer: string | null;
  insight: string;
  analyzedAt: string;
}

export async function analyzeAgentPerformance(projectId: string): Promise<AgentPerformanceReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      storyPoints: tickets.storyPoints,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Group by assignedPersona, skip null/unassigned
  const agentMap = new Map<
    string,
    Array<{
      id: string;
      status: string;
      storyPoints: number | null;
      priority: string;
    }>
  >();

  for (const ticket of allTickets) {
    const persona = ticket.assignedPersona as string | null;
    if (!persona) continue;

    if (!agentMap.has(persona)) {
      agentMap.set(persona, []);
    }
    agentMap.get(persona)!.push({
      id: ticket.id,
      status: ticket.status as string,
      storyPoints: ticket.storyPoints,
      priority: ticket.priority as string,
    });
  }

  const agents: AgentMetrics[] = [];

  for (const [agentName, agentTickets] of agentMap.entries()) {
    const doneTickets = agentTickets.filter((t) => t.status === 'done');
    const inProgressTicketsList = agentTickets.filter(
      (t) => t.status === 'in_progress' || t.status === 'review' || t.status === 'qa',
    );

    const completedTickets = doneTickets.length;
    const inProgressTickets = inProgressTicketsList.length;

    const totalStoryPointsDelivered = doneTickets.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );

    const avgStoryPointsPerTicket =
      completedTickets > 0
        ? totalStoryPointsDelivered / completedTickets
        : 0;

    const totalAssigned = agentTickets.length;
    const completionRate =
      totalAssigned > 0
        ? Math.round((completedTickets / totalAssigned) * 1000) / 10
        : 0;

    // Top 2 priorities from done tickets by frequency
    const priorityFreq: Record<string, number> = {};
    for (const t of doneTickets) {
      priorityFreq[t.priority] = (priorityFreq[t.priority] || 0) + 1;
    }
    const topTicketTypes = Object.entries(priorityFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([priority]) => priority);

    let performanceTier: AgentMetrics['performanceTier'];
    if (completionRate > 70) performanceTier = 'high';
    else if (completionRate >= 40) performanceTier = 'medium';
    else performanceTier = 'low';

    agents.push({
      agentName,
      completedTickets,
      inProgressTickets,
      totalStoryPointsDelivered,
      avgStoryPointsPerTicket,
      completionRate,
      topTicketTypes,
      performanceTier,
    });
  }

  // Top performer: agent with highest completionRate
  let topPerformer: string | null = null;
  if (agents.length > 0) {
    const best = agents.reduce((prev, curr) =>
      curr.completionRate > prev.completionRate ? curr : prev,
    );
    topPerformer = best.agentName;
  }

  // AI insight via OpenRouter
  let insight = 'Performance analysis based on ticket completion data';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = agents
      .map(
        (a) =>
          `${a.agentName}: ${a.completedTickets} done, ${a.inProgressTickets} in-progress, ${a.completionRate}% completion rate, tier=${a.performanceTier}, top priorities=${a.topTicketTypes.join(',')}`,
      )
      .join('\n');

    const prompt = `You are an AI performance analyst. Analyze this AI agent performance data and provide routing recommendations and flag any concerning patterns.

Agent performance summary:
${summaryLines || 'No agents with assigned tickets.'}
Top performer: ${topPerformer ?? 'none'}

Respond with 2-3 sentences only. Focus on routing recommendations and concerning patterns. No JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) insight = content;
  } catch (e) {
    console.warn('Agent performance AI insight failed, using fallback:', e);
    insight = 'Performance analysis based on ticket completion data';
  }

  return {
    projectId,
    agents,
    topPerformer,
    insight,
    analyzedAt: new Date().toISOString(),
  };
}
