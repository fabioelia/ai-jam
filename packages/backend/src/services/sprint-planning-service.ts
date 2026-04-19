import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface SprintPlanTicket {
  id: string;
  title: string;
  storyPoints: number;
  priority: string;
  reason: string;
}

interface SprintPlan {
  recommendedTickets: SprintPlanTicket[];
  sprintGoal: string;
  estimatedPoints: number;
  capacityUtilization: number;
  risks: string[];
  confidence: number;
  reasoning: string;
}

function fallback(note?: string): SprintPlan {
  return {
    recommendedTickets: [],
    sprintGoal: 'No backlog tickets available for planning',
    estimatedPoints: 0,
    capacityUtilization: 0,
    risks: ['Backlog is empty — add tickets before sprint planning'],
    confidence: 0,
    reasoning: note || 'Insufficient data for AI sprint planning',
  };
}

export async function generateSprintPlan(projectId: string): Promise<SprintPlan> {
  const projectTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  if (projectTickets.length === 0) return fallback();

  const backlogTickets = projectTickets.filter(
    t => t.status === 'backlog' && t.storyPoints != null,
  );
  const inProgressTickets = projectTickets.filter(t => t.status === 'in_progress');
  const completedTickets = projectTickets.filter(
    t => t.status === 'done' && t.storyPoints != null,
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);

  const totalCompletedPoints = completedTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const velocity = completedTickets.length > 0
    ? totalCompletedPoints / completedTickets.length
    : 20;

  if (backlogTickets.length === 0) return fallback('Backlog is empty — no tickets available for sprint planning');

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const formatTickets = (list: typeof projectTickets) =>
    list
      .map(t => `- [${t.id}] ${t.title} (priority: ${t.priority}, points: ${t.storyPoints ?? 0})`)
      .join('\n');

  const activePoints = inProgressTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

  const prompt = `You are a scrum master. Given the current backlog and recent velocity, recommend which tickets to include in the next sprint.

BACKLOG tickets (candidates for next sprint):
${formatTickets(backlogTickets)}

IN PROGRESS tickets (already consuming capacity this sprint):
${formatTickets(inProgressTickets)}

Velocity: ${velocity} story points (average of last ${completedTickets.length} completed tickets).
In-progress consumption: ${inProgressTickets.length} tickets, ${activePoints} points.

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "recommendedTickets": [{"id":"T-1","title":"...","storyPoints":3,"priority":"high","reason":"..."}],
  "sprintGoal": "...",
  "estimatedPoints": N,
  "capacityUtilization": 0.85,
  "risks": ["..."],
  "confidence": 0.8,
  "reasoning": "..."
}

Rules:
- Recommend 5-10 tickets from backlog, prioritizing: critical > high > medium
- Total estimatedPoints should be ~1.0x velocity, accounting for in-progress consumption
- Each reason is 1 sentence: why this ticket should be in the sprint
- sprintGoal is 1 sentence summarizing the sprint theme
- risks: 2-3 items — dependency gaps, high-complexity items, unclear requirements
- capacityUtilization = estimatedPoints / velocity, between 0 and 2
- confidence: 0.0-1.0 based on data quality
- reasoning: 2-3 sentences explaining the plan assessment
- Do not invent work not listed in the backlog`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return fallback('AI service unavailable');
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback('AI response could not be parsed');
  }

  const rawTickets = Array.isArray(parsed.recommendedTickets) ? parsed.recommendedTickets : [];
  const recommendedTickets: SprintPlanTicket[] = rawTickets
    .map((t: Record<string, unknown>) => {
      const id = typeof t.id === 'string' ? t.id : '';
      const title = typeof t.title === 'string' ? t.title : '';
      const storyPoints = typeof t.storyPoints === 'number' ? t.storyPoints : 0;
      const priority = typeof t.priority === 'string' ? t.priority : 'medium';
      const reason = typeof t.reason === 'string' ? t.reason : '';
      return { id, title, storyPoints, priority, reason };
    })
    .filter((t: SprintPlanTicket) => t.id && t.title);

  const estimatedPoints = recommendedTickets.reduce((sum: number, t: SprintPlanTicket) => sum + t.storyPoints, 0);
  const rawCapacity = velocity > 0 ? estimatedPoints / velocity : 0;
  const capacityUtilization = Math.min(2, Math.max(0, rawCapacity));

  const risks = Array.isArray(parsed.risks)
    ? parsed.risks.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    : [];

  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(1, Math.max(0, parsed.confidence))
    : 0;

  return {
    recommendedTickets,
    sprintGoal: typeof parsed.sprintGoal === 'string' && parsed.sprintGoal.trim()
      ? parsed.sprintGoal
      : 'No sprint goal generated',
    estimatedPoints,
    capacityUtilization,
    risks,
    confidence,
    reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning
      : 'No reasoning provided',
  };
}
