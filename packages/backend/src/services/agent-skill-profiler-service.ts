import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentSkillProfile {
  agentName: string;
  totalAssigned: number;
  completedCount: number;
  completionRate: number;
  avgStoryPoints: number;
  complexityScore: number;
  specialization: string | null;
  proficiencyTier: 'expert' | 'proficient' | 'developing';
  priorityBreakdown: { critical: number; high: number; medium: number; low: number };
}

export interface SkillProfileReport {
  projectId: string;
  profiles: AgentSkillProfile[];
  topExpert: string | null;
  insight: string;
  analyzedAt: string;
}

export async function profileAgentSkills(projectId: string): Promise<SkillProfileReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      priority: tickets.priority,
      status: tickets.status,
      storyPoints: tickets.storyPoints,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Group by assignedPersona, skip null
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

  const profiles: AgentSkillProfile[] = [];

  for (const [agentName, agentTickets] of agentMap.entries()) {
    const doneTickets = agentTickets.filter((t) => t.status === 'done');

    const totalAssigned = agentTickets.length;
    const completedCount = doneTickets.length;
    const completionRate = totalAssigned > 0
      ? Math.round((completedCount / totalAssigned) * 1000) / 10
      : 0;

    const avgStoryPoints = completedCount > 0
      ? Math.round((doneTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0) / completedCount) * 10) / 10
      : 0;

    // Priority breakdown from done tickets
    const priorityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of doneTickets) {
      const p = t.priority as keyof typeof priorityBreakdown;
      if (p in priorityBreakdown) {
        priorityBreakdown[p]++;
      }
    }

    // complexityScore: weighted sum of done tickets by priority / max(completedCount, 1)
    const weightedSum =
      priorityBreakdown.critical * 4 +
      priorityBreakdown.high * 3 +
      priorityBreakdown.medium * 2 +
      priorityBreakdown.low * 1;
    const complexityScore = Math.round((weightedSum / Math.max(completedCount, 1)) * 10) / 10;

    // specialization: highest-count priority in done tickets; tie-break: critical > high > medium > low
    let specialization: string | null = null;
    if (completedCount > 0) {
      const priorities: Array<keyof typeof priorityBreakdown> = ['critical', 'high', 'medium', 'low'];
      let maxCount = -1;
      for (const p of priorities) {
        if (priorityBreakdown[p] > maxCount) {
          maxCount = priorityBreakdown[p];
          specialization = p;
        }
      }
    }

    // proficiencyTier
    let proficiencyTier: AgentSkillProfile['proficiencyTier'];
    if (complexityScore >= 3) proficiencyTier = 'expert';
    else if (complexityScore >= 2) proficiencyTier = 'proficient';
    else proficiencyTier = 'developing';

    profiles.push({
      agentName,
      totalAssigned,
      completedCount,
      completionRate,
      avgStoryPoints,
      complexityScore,
      specialization,
      proficiencyTier,
      priorityBreakdown,
    });
  }

  // topExpert: agent with highest complexityScore
  let topExpert: string | null = null;
  if (profiles.length > 0) {
    const best = profiles.reduce((prev, curr) =>
      curr.complexityScore > prev.complexityScore ? curr : prev,
    );
    topExpert = best.agentName;
  }

  // AI insight via OpenRouter
  let insight = 'Skill profiles based on ticket completion history';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summaryLines = profiles
      .map(
        (p) =>
          `${p.agentName}: tier=${p.proficiencyTier}, complexityScore=${p.complexityScore}, completionRate=${p.completionRate}%, specialization=${p.specialization ?? 'none'}, avgStoryPoints=${p.avgStoryPoints}`,
      )
      .join('\n');

    const prompt = `You are an AI skill analyst. Summarize this AI agent team's skill distribution and recommend a delegation strategy.

Agent skill profiles:
${summaryLines || 'No agents with assigned tickets.'}
Top expert: ${topExpert ?? 'none'}

Respond with 2-3 sentences only. Focus on skill distribution and delegation recommendations. No JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) insight = content;
  } catch (e) {
    console.warn('Agent skill profiler AI insight failed, using fallback:', e);
    insight = 'Skill profiles based on ticket completion history';
  }

  return {
    projectId,
    profiles,
    topExpert,
    insight,
    analyzedAt: new Date().toISOString(),
  };
}
