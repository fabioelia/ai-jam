import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface PriorityGap {
  priority: 'critical' | 'high' | 'medium' | 'low';
  openTickets: number;
  unassignedCount: number;
  assignedAgents: string[];
  gapSeverity: 'critical' | 'moderate' | 'none';
}

export interface KnowledgeGapReport {
  projectId: string;
  gaps: PriorityGap[];
  topGap: string | null;
  insight: string;
  analyzedAt: string;
}

const PRIORITIES: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

export async function analyzeKnowledgeGaps(projectId: string): Promise<KnowledgeGapReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      priority: tickets.priority,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      storyPoints: tickets.storyPoints,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Filter open tickets (status !== 'done')
  const openTickets = allTickets.filter((t) => t.status !== 'done');

  const gaps: PriorityGap[] = [];

  for (const priority of PRIORITIES) {
    const priorityTickets = openTickets.filter((t) => t.priority === priority);
    const demand = priorityTickets.length;

    if (demand === 0) continue;

    const unassignedCount = priorityTickets.filter((t) => t.assignedPersona === null).length;
    const assignedAgents = [
      ...new Set(
        priorityTickets
          .map((t) => t.assignedPersona as string | null)
          .filter((p): p is string => p !== null),
      ),
    ];
    const agentCount = assignedAgents.length;

    let gapSeverity: 'critical' | 'moderate' | 'none';
    if (unassignedCount >= 3 || (agentCount === 0 && demand > 0)) {
      gapSeverity = 'critical';
    } else if (unassignedCount >= 1 && unassignedCount <= 2) {
      gapSeverity = 'moderate';
    } else {
      gapSeverity = 'none';
    }

    gaps.push({
      priority,
      openTickets: demand,
      unassignedCount,
      assignedAgents,
      gapSeverity,
    });
  }

  // Find topGap: priority with highest gapSeverity, break ties by unassignedCount
  const severityRank = { critical: 2, moderate: 1, none: 0 };
  let topGap: string | null = null;
  if (gaps.length > 0) {
    const best = gaps.reduce((prev, curr) => {
      const prevRank = severityRank[prev.gapSeverity];
      const currRank = severityRank[curr.gapSeverity];
      if (currRank > prevRank) return curr;
      if (currRank === prevRank && curr.unassignedCount > prev.unassignedCount) return curr;
      return prev;
    });
    if (best.gapSeverity !== 'none') {
      topGap = best.priority;
    }
  }

  // AI insight via OpenRouter
  let insight = 'Analysis based on current ticket assignment distribution';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = gaps
      .map(
        (g) =>
          `priority=${g.priority}: openTickets=${g.openTickets}, unassigned=${g.unassignedCount}, agents=${g.assignedAgents.join(', ') || 'none'}, severity=${g.gapSeverity}`,
      )
      .join('\n');

    const prompt = `You are an AI project analyst. Review this knowledge gap analysis for an AI agent team and summarize the most critical gap and recommended action.

Knowledge gap data by priority:
${summaryLines || 'No open tickets found.'}
Top gap priority: ${topGap ?? 'none'}

Respond with 2-3 sentences only. Focus on the most critical knowledge gap and what action should be taken. No JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) insight = content;
  } catch (e) {
    console.warn('Agent knowledge gap AI insight failed, using fallback:', e);
    insight = 'Analysis based on current ticket assignment distribution';
  }

  return {
    projectId,
    gaps,
    topGap,
    insight,
    analyzedAt: new Date().toISOString(),
  };
}
