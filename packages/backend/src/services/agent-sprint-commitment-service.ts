import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, gte, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentCommitmentRecord {
  agentType: string;
  plannedTickets: number;
  completedTickets: number;
  commitmentRatio: number;
  status: 'overcommitted' | 'on-track' | 'underutilized';
  statusExplanation: string;
}

export interface SprintCommitmentReport {
  projectId: string;
  sprintWindowDays: 14;
  totalPlanned: number;
  totalCompleted: number;
  overallCommitmentRatio: number;
  overcommittedAgents: number;
  onTrackAgents: number;
  underutilizedAgents: number;
  agentRecords: AgentCommitmentRecord[];
  aiRecommendation: string;
  analyzedAt: string;
}

const FALLBACK_RECOMMENDATION = 'Review agent capacity allocation to optimize sprint commitment rates.';
const SPRINT_WINDOW_DAYS = 14;

function computeStatus(ratio: number): AgentCommitmentRecord['status'] {
  if (ratio < 0.6) return 'overcommitted';
  if (ratio > 1.2) return 'underutilized';
  return 'on-track';
}

function computeStatusExplanation(status: AgentCommitmentRecord['status'], agentType: string, ratio: number): string {
  switch (status) {
    case 'overcommitted': return `${agentType} completed ${(ratio * 100).toFixed(0)}% of planned tickets — under 60% threshold.`;
    case 'underutilized': return `${agentType} completed ${(ratio * 100).toFixed(0)}% of planned tickets — over 120% threshold, has excess capacity.`;
    default: return `${agentType} completed ${(ratio * 100).toFixed(0)}% of planned tickets — within healthy range.`;
  }
}

export async function analyzeSprintCommitment(projectId: string): Promise<SprintCommitmentReport> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - SPRINT_WINDOW_DAYS);

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  const planned = allTickets.filter((t) => t.createdAt >= windowStart);
  const completed = allTickets.filter((t) => t.status === 'done' && t.updatedAt >= windowStart);

  if (planned.length === 0 && completed.length === 0) {
    return {
      projectId,
      sprintWindowDays: 14,
      totalPlanned: 0,
      totalCompleted: 0,
      overallCommitmentRatio: 0,
      overcommittedAgents: 0,
      onTrackAgents: 0,
      underutilizedAgents: 0,
      agentRecords: [],
      aiRecommendation: FALLBACK_RECOMMENDATION,
      analyzedAt: new Date().toISOString(),
    };
  }

  const agentPlanned = new Map<string, number>();
  const agentCompleted = new Map<string, number>();

  for (const t of planned) {
    const persona = t.assignedPersona as string;
    agentPlanned.set(persona, (agentPlanned.get(persona) ?? 0) + 1);
  }

  for (const t of completed) {
    const persona = t.assignedPersona as string;
    agentCompleted.set(persona, (agentCompleted.get(persona) ?? 0) + 1);
  }

  const allAgents = new Set([...agentPlanned.keys(), ...agentCompleted.keys()]);

  const agentRecords: AgentCommitmentRecord[] = [];
  for (const agentType of allAgents) {
    const plannedCount = agentPlanned.get(agentType) ?? 0;
    const completedCount = agentCompleted.get(agentType) ?? 0;
    const commitmentRatio = plannedCount === 0 ? 0 : completedCount / plannedCount;
    const status = computeStatus(commitmentRatio);
    agentRecords.push({
      agentType,
      plannedTickets: plannedCount,
      completedTickets: completedCount,
      commitmentRatio,
      status,
      statusExplanation: computeStatusExplanation(status, agentType, commitmentRatio),
    });
  }

  agentRecords.sort((a, b) => a.commitmentRatio - b.commitmentRatio);

  const totalPlanned = planned.length;
  const totalCompleted = completed.length;
  const overallCommitmentRatio = totalPlanned === 0 ? 0 : totalCompleted / totalPlanned;
  const overcommittedAgents = agentRecords.filter((r) => r.status === 'overcommitted').length;
  const onTrackAgents = agentRecords.filter((r) => r.status === 'on-track').length;
  const underutilizedAgents = agentRecords.filter((r) => r.status === 'underutilized').length;

  let aiRecommendation = FALLBACK_RECOMMENDATION;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentRecords
      .map(
        (r) =>
          `Agent: ${r.agentType}, Planned: ${r.plannedTickets}, Completed: ${r.completedTickets}, Ratio: ${(r.commitmentRatio * 100).toFixed(0)}%, Status: ${r.status}`,
      )
      .join('\n');

    const prompt = `Analyze this sprint commitment data and write a single paragraph (2-3 sentences) with an actionable recommendation for improving agent commitment rates. Be concise.\n\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) aiRecommendation = content;
  } catch (e) {
    console.warn('Sprint commitment AI recommendation failed, using fallback:', e);
  }

  return {
    projectId,
    sprintWindowDays: 14,
    totalPlanned,
    totalCompleted,
    overallCommitmentRatio,
    overcommittedAgents,
    onTrackAgents,
    underutilizedAgents,
    agentRecords,
    aiRecommendation,
    analyzedAt: new Date().toISOString(),
  };
}
