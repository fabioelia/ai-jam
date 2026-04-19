import { db } from '../db/connection.js';
import { projects, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AssigneeLoad {
  assignee: string;
  ticketCount: number;
  totalStoryPoints: number;
  loadScore: number;
  status: 'overloaded' | 'balanced' | 'underloaded';
}

export interface WorkloadRecommendation {
  fromAssignee: string;
  toAssignee: string;
  ticketId: string;
  ticketTitle: string;
  reason: string;
}

export interface WorkloadAnalysis {
  projectId: string;
  featureId: string | null;
  assigneeLoads: AssigneeLoad[];
  recommendations: WorkloadRecommendation[];
  overallBalance: 'well-balanced' | 'moderate-imbalance' | 'severe-imbalance';
  narrative: string;
  analyzedAt: string;
}

function calcMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calcStddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export async function analyzeWorkload(
  projectId: string,
  featureId?: string,
): Promise<WorkloadAnalysis | null> {
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projectRows.length === 0) return null;

  const allTickets = featureId
    ? await db.select().from(tickets).where(eq(tickets.featureId, featureId))
    : await db.select().from(tickets).where(eq(tickets.projectId, projectId));

  // Group by assignee, skip unassigned
  const assigneeMap = new Map<
    string,
    { ticketCount: number; totalStoryPoints: number; tickets: Array<{ id: string; title: string; storyPoints: number; priority: string }> }
  >();

  for (const ticket of allTickets) {
    const assignee = ticket.assignedPersona as string | null;
    if (!assignee) continue;

    if (!assigneeMap.has(assignee)) {
      assigneeMap.set(assignee, { ticketCount: 0, totalStoryPoints: 0, tickets: [] });
    }
    const entry = assigneeMap.get(assignee)!;
    entry.ticketCount++;
    const sp = typeof ticket.storyPoints === 'number' ? ticket.storyPoints : 0;
    entry.totalStoryPoints += sp;
    entry.tickets.push({
      id: ticket.id,
      title: ticket.title,
      storyPoints: sp,
      priority: (ticket.priority as string) || 'low',
    });
  }

  if (assigneeMap.size === 0) {
    return {
      projectId,
      featureId: featureId ?? null,
      assigneeLoads: [],
      recommendations: [],
      overallBalance: 'well-balanced',
      narrative: 'No assigned tickets found. Workload analysis requires assigned tickets.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // Calculate load scores
  const rawLoads: Array<{ assignee: string; ticketCount: number; totalStoryPoints: number; loadScore: number; tickets: Array<{ id: string; title: string; storyPoints: number; priority: string }> }> = [];
  for (const [assignee, data] of assigneeMap.entries()) {
    const loadScore = data.ticketCount * 1 + data.totalStoryPoints * 0.5;
    rawLoads.push({ assignee, ...data, loadScore });
  }

  const scores = rawLoads.map((l) => l.loadScore);
  const mean = calcMean(scores);
  const stddev = calcStddev(scores, mean);

  const assigneeLoads: AssigneeLoad[] = rawLoads.map((l) => {
    let status: AssigneeLoad['status'] = 'balanced';
    if (stddev > 0) {
      if (l.loadScore > mean + 1.5 * stddev) status = 'overloaded';
      else if (l.loadScore < mean - 1.5 * stddev) status = 'underloaded';
    }
    return {
      assignee: l.assignee,
      ticketCount: l.ticketCount,
      totalStoryPoints: l.totalStoryPoints,
      loadScore: l.loadScore,
      status,
    };
  });

  // Generate recommendations: overloaded → underloaded
  const overloaded = rawLoads.filter((_, i) => assigneeLoads[i].status === 'overloaded');
  const underloaded = assigneeLoads.filter((l) => l.status === 'underloaded');

  const recommendations: WorkloadRecommendation[] = [];
  for (const ol of overloaded) {
    const target = underloaded[0];
    if (!target) break;
    // Find highest story-point non-critical ticket
    const candidate = ol.tickets
      .filter((t) => t.priority !== 'critical')
      .sort((a, b) => b.storyPoints - a.storyPoints)[0];
    if (candidate) {
      recommendations.push({
        fromAssignee: ol.assignee,
        toAssignee: target.assignee,
        ticketId: candidate.id,
        ticketTitle: candidate.title,
        reason: `${ol.assignee} is overloaded (score ${ol.loadScore.toFixed(1)}); ${target.assignee} has capacity (score ${target.loadScore.toFixed(1)})`,
      });
    }
  }

  // Overall balance
  const overloadedCount = assigneeLoads.filter((l) => l.status === 'overloaded' || l.status === 'underloaded').length;
  let overallBalance: WorkloadAnalysis['overallBalance'];
  if (overloadedCount === 0) overallBalance = 'well-balanced';
  else if (overloadedCount === 1) overallBalance = 'moderate-imbalance';
  else overallBalance = 'severe-imbalance';

  // AI narrative
  let narrative = 'Workload analysis based on ticket distribution';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = assigneeLoads
      .map((l) => `${l.assignee}: ${l.ticketCount} tickets, ${l.totalStoryPoints} SP, score=${l.loadScore.toFixed(1)}, ${l.status}`)
      .join('\n');

    const prompt = `Analyze this team workload distribution and provide 2-3 sentences summarizing the balance and top recommendation.

Workload summary:
${summaryLines}
Overall balance: ${overallBalance}
${recommendations.length > 0 ? `Top recommendation: move ticket "${recommendations[0].ticketTitle}" from ${recommendations[0].fromAssignee} to ${recommendations[0].toAssignee}` : 'No rebalancing needed.'}

Respond with 2-3 sentences only. No JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) narrative = content;
  } catch (e) {
    console.warn('Workload balancer AI failed:', e);
    narrative = 'Workload analysis based on ticket distribution';
  }

  return {
    projectId,
    featureId: featureId ?? null,
    assigneeLoads,
    recommendations,
    overallBalance,
    narrative,
    analyzedAt: new Date().toISOString(),
  };
}
